#!/usr/bin/env python3
"""Голоса персонажей по описанию: OmniVoice voice design → выбор на слух → снимки под модели → пакет.

Запускается окружением OmniVoice из clone-server шлюза — там torch, omnivoice и numpy (свои зависимости не нужны):

    CS=../voice-gateway-server/clone-server
    $CS/runtime/omnivoice/env/bin/python tools/design.py candidates arthur          # 10 вариантов фразы образца
    open work/arthur/index.html                                                     # послушать, выбрать номер
    $CS/runtime/omnivoice/env/bin/python tools/design.py adopt arthur 7             # вариант 7 → пакет

candidates — варианты одной фразы (voices.json → reference) по описанию голоса (instruct) в work/<id>/candidates/,
с номером «зерна» у каждого, чтобы вариант можно было повторить. Повторный запуск добавляет варианты (можно с другим
--instruct), --fresh начинает заново.

adopt — выбранный вариант становится голосом персонажа:
  1. clone-server/imprint.py под каждую установленную модель (omnivoice, cosyvoice3) снимает снимок; образец — весь
     вариант целиком (5–8 с речи), слова образца известны — распознавание не нужно (imprint.py получает их от
     маленького сервера слов здесь же, на 127.0.0.1);
  2. assets/voices/ref.wav — тот самый кусок, с которого сняты снимки; assets/voices/<модель>.pt — снимки;
  3. до трёх фраз-пробников (voices.json → samples) голосом первой модели → assets/samples/N.opus (Opus, до 64 КБ);
  4. manifest.json: voices (файл и ревизия весов модели), ref (файл и слова), samples; voices.json → adopted.

Модель, которой нет в clone-server/runtime, пропускается: шлюз снимет её снимок сам из ref.wav, когда она встанет.
Это работа на видеокарте и минуты времени — запускает владелец, слушает и утверждает он же. Только синтетические голоса:
ничьих записей здесь нет и быть не должно.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import random
import re
import shutil
import subprocess
import sys
import threading
import time
import wave
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VOICES_FILE = REPO / "voices.json"
PACKAGES = REPO / "packages"
WORK = REPO / "work"
ENGINES = ("omnivoice", "cosyvoice3")
MAX_SAMPLES = 3
SAMPLE_LIMIT = 64 * 1024
#: Вокруг длины речи варианта: imprint.py возьмёт образцом ровно весь вариант, а не его кусок (кусок короче минимум на
#: фразу ≥ 0,3 с и паузу ≥ 0,25 с — voicelab/audio.py).
SPAN_SLACK = 0.25
#: Паузы шире — imprint.py режет образец на этом месте (voicelab/audio.py, widest_pause).
WIDEST_PAUSE = 0.7


def die(message: str) -> None:
    print(f"✗ {message}", file=sys.stderr)
    sys.exit(1)


def say(message: str) -> None:
    print(message, flush=True)


# ---- JSON в том же виде, что в репозитории ----


def dumps(value, indent: str = "") -> str:
    """Отступ в два пробела; короткие списки строк — в строку; маленькие объекты из строк и чисел — в строку."""
    inner = indent + "  "
    scalar = lambda v: not isinstance(v, (dict, list))  # noqa: E731
    if isinstance(value, list):
        if not value:
            return "[]"
        if all(scalar(v) for v in value):
            line = "[" + ", ".join(json.dumps(v, ensure_ascii=False) for v in value) + "]"
            if len(line) <= 100:
                return line
        return "[\n" + ",\n".join(inner + dumps(v, inner) for v in value) + "\n" + indent + "]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        if len(value) <= 3 and all(scalar(v) for v in value.values()):
            pairs = ", ".join(f"{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}" for k, v in value.items())
            return "{ " + pairs + " }"
        items = ",\n".join(f"{inner}{json.dumps(k, ensure_ascii=False)}: {dumps(v, inner)}" for k, v in value.items())
        return "{\n" + items + "\n" + indent + "}"
    return json.dumps(value, ensure_ascii=False)


def write_json(path: Path, value) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(dumps(value) + "\n", encoding="utf-8")
    temp.replace(path)


# ---- шлюз: clone-server и его окружения ----


def clone_server(args) -> Path:
    path = Path(args.clone_server or os.environ.get("CLONE_SERVER") or REPO.parent / "voice-gateway-server" / "clone-server")
    path = path.resolve()
    if not (path / "imprint.py").exists() or not (path / "voicelab").is_dir():
        die(f"{path}: это не clone-server шлюза — укажите --clone-server или CLONE_SERVER")
    sys.path.insert(0, str(path))
    return path


def env_python(runtime: Path) -> Path | None:
    for candidate in (runtime / "env" / "bin" / "python", runtime / "env" / "Scripts" / "python.exe"):
        if candidate.exists():
            return candidate
    return None


def engine_ready(cs: Path, engine: str) -> bool:
    runtime = cs / "runtime" / engine
    return (runtime / "ready.json").exists() and env_python(runtime) is not None


def revision(cs: Path, engine: str) -> str:
    """Ревизия весов, на которых снят снимок: шлюз переснимет голос из ref, если у него она другая."""
    runtime = cs / "runtime" / engine
    if engine == "omnivoice":
        ref = runtime / "hf-cache" / "hub" / "models--k2-fsa--OmniVoice" / "refs" / "main"
        if ref.exists():
            return ref.read_text().strip()[:8]
    if engine == "cosyvoice3":
        try:
            head = subprocess.run(
                ["git", "-C", str(runtime / "repo"), "rev-parse", "HEAD"], capture_output=True, text=True, check=True
            ).stdout.strip()
            if head:
                return head[:8]
        except (OSError, subprocess.CalledProcessError):
            pass
        requirements = cs / "requirements" / "cosyvoice3.txt"
        if requirements.exists():
            found = re.search(r"repository at ([0-9a-f]{7,40})", requirements.read_text())
            if found:
                return found.group(1)[:8]
    die(f"не знаю ревизию весов {engine} в {runtime}")
    return ""


def voicelab_audio():
    try:
        from voicelab import audio  # noqa: WPS433 — из clone-server, путь добавлен в clone_server()
    except ImportError as error:
        die(f"не загрузился voicelab ({error}) — запускайте окружением OmniVoice: clone-server/runtime/omnivoice/env/bin/python")
    return audio


# ---- voices.json и work/ ----


def load_voices() -> dict:
    return json.loads(VOICES_FILE.read_text(encoding="utf-8"))


def spec_of(voices: dict, character: str) -> dict:
    spec = voices.get("characters", {}).get(character)
    if not spec:
        die(f"в voices.json нет персонажа «{character}» (есть {', '.join(voices.get('characters', {}))})")
    for key in ("instruct", "reference"):
        if not str(spec.get(key) or "").strip():
            die(f"voices.json → {character}: нет {key}")
    return spec


def state_path(character: str) -> Path:
    return WORK / character / "candidates.json"


def load_state(character: str) -> dict | None:
    path = state_path(character)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def reference_fit(audio, path: Path) -> tuple[bool, float, str]:
    """Годится ли вариант в образец целиком: речь 4–10 с (лучше 5–8) без пауз шире 0,7 с."""
    samples, rate = audio.read_wav(path)
    runs, _floor = audio.speech_runs(samples, rate)
    if not runs:
        return False, 0.0, "не слышно речи"
    span = runs[-1].end - runs[0].start
    widest = max((b.start - a.end for a, b in zip(runs, runs[1:])), default=0.0)
    if widest > WIDEST_PAUSE:
        return False, span, f"пауза {widest:.1f} с — образец разрежется"
    if span < 4.0:
        return False, span, "короче 4 с — мало для образца"
    if span > 10.0:
        return False, span, "длиннее 10 с — образец будет медленным"
    if span < 5.0 or span > 8.0:
        return True, span, "годится, но лучше 5–8 с"
    return True, span, "годится"


def write_listening_page(character: str, state: dict) -> Path:
    folder = WORK / character
    title = html.escape(state.get("title") or character)
    rows = []
    for item in state["candidates"]:
        mark = "" if item["fits"] else ' class="no"'
        rows.append(
            f'<li{mark}><b>{item["n"]:02d}</b> · {item["seconds"]:.1f} с · {html.escape(item["verdict"])}'
            f' · <code>{html.escape(item["instruct"])}</code> · зерно {item["seed"]}<br>'
            f'<audio controls preload="none" src="candidates/{html.escape(item["file"])}"></audio></li>'
        )
    page = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — варианты голоса</title>
<style>
body{{font:15px/1.5 system-ui,-apple-system,sans-serif;margin:24px auto;max-width:820px;padding:0 16px;color:#1c1f1d;background:#f6f6f2}}
li{{margin:14px 0}} li.no{{opacity:.55}} code{{font-size:13px;background:#e8e8e2;padding:1px 5px;border-radius:4px}}
audio{{width:100%;margin-top:4px}}
</style></head><body>
<h1>{title}: варианты голоса</h1>
<p>Фраза: «{html.escape(state["text"])}»</p>
<ol>{"".join(rows)}</ol>
<p>Выбрали — <code>…/env/bin/python tools/design.py adopt {html.escape(character)} &lt;номер&gt;</code></p>
</body></html>
"""
    path = folder / "index.html"
    path.write_text(page, encoding="utf-8")
    return path


# ---- candidates ----


def cmd_candidates(args) -> None:
    cs = clone_server(args)
    voices = load_voices()
    spec = spec_of(voices, args.character)
    instruct = (args.instruct or spec["instruct"]).strip()
    text = (args.text or spec["reference"]).strip()
    runtime = cs / "runtime" / "omnivoice"
    if not engine_ready(cs, "omnivoice"):
        die(f"OmniVoice не установлен в {runtime} — поставьте его в пульте шлюза: «Модели» → «Голос»")

    audio = voicelab_audio()
    from voicelab.engines import pick_device, prepare_environment

    prepare_environment(runtime)  # веса — только из кеша окружения, без сети
    import numpy as np
    import torch
    from omnivoice import OmniVoice

    folder = WORK / args.character
    candidates = folder / "candidates"
    state = None if args.fresh else load_state(args.character)
    if args.fresh and folder.exists():
        shutil.rmtree(candidates, ignore_errors=True)
    if state and state.get("text") != text:
        die("фраза образца поменялась — варианты разных фраз не сравнить; запустите с --fresh")
    candidates.mkdir(parents=True, exist_ok=True)
    manifest = PACKAGES / args.character / "manifest.json"
    title = json.loads(manifest.read_text(encoding="utf-8")).get("title") if manifest.exists() else args.character
    state = state or {"character": args.character, "title": title, "text": text, "language": voices.get("language", "ru"), "candidates": []}

    device = pick_device(torch, "omnivoice", args.device)
    dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
    say(f"OmniVoice на {device}: загружаю модель…")
    model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map=device, dtype=dtype)
    rate = int(model.sampling_rate)
    say(f"«{text}»\nописание: {instruct}")

    first = max((item["n"] for item in state["candidates"]), default=0) + 1
    for n in range(first, first + args.count):
        seed = args.seed + n
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        began = time.time()
        kwargs = {"class_temperature": args.temperature} if args.temperature is not None else {}
        result = model.generate(text=text, language=state["language"], instruct=instruct, speed=args.speed, **kwargs)
        pcm = audio.to_int16(np.asarray(result[0], dtype=np.float32).reshape(-1))
        name = f"{n:02d}.wav"
        with wave.open(str(candidates / name), "wb") as target:
            target.setnchannels(1)
            target.setsampwidth(2)
            target.setframerate(rate)
            target.writeframes(pcm.tobytes())
        fits, span, verdict = reference_fit(audio, candidates / name)
        state["candidates"].append(
            {
                "n": n,
                "file": name,
                "seed": seed,
                "instruct": instruct,
                "speed": args.speed,
                "temperature": args.temperature,
                "seconds": round(pcm.size / rate, 2),
                "speech": round(span, 2),
                "fits": fits,
                "verdict": verdict,
            }
        )
        write_json(state_path(args.character), state)
        say(f"  {n:02d}  {pcm.size / rate:4.1f} с, речь {span:4.1f} с — {verdict}  ({time.time() - began:.0f} с)")

    page = write_listening_page(args.character, state)
    say(f"\nПослушать: open {page.relative_to(Path.cwd()) if page.is_relative_to(Path.cwd()) else page}")
    say(f"Выбрать:   …/env/bin/python tools/design.py adopt {args.character} <номер>")


# ---- adopt ----


class WordsServer:
    """Распознавание, которое знает ответ: imprint.py спрашивает слова образца — а они нам известны."""

    def __init__(self, text: str):
        payload = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802 — имя метода задаёт http.server
                length = int(self.headers.get("Content-Length") or 0)
                self.rfile.read(length)
                if not self.path.rstrip("/").endswith("/audio/transcriptions"):
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args):  # тишина в консоли
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/v1"

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()


def run_imprint(command: list[str], engine: str, log: Path) -> dict:
    say(f"  {engine}: снимаю отпечаток (imprint.py)…")
    with log.open("w", encoding="utf-8") as errors:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors, text=True, encoding="utf-8")
        final: dict = {}
        assert process.stdout is not None
        for line in process.stdout:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "error" in event:
                final = event
            elif "stage" in event:
                say(f"    {event['stage']} {event.get('percent', '')}%")
                if event["stage"] == "done":
                    final = event
        code = process.wait()
    if code != 0 or "error" in final or final.get("stage") != "done":
        die(f"{engine}: снимок не снят — {final.get('error') or f'код {code}'} (журнал: {log})")
    return final


def to_opus(ffmpeg: str, source: Path, target: Path) -> int:
    """WAV → Opus (Ogg) без метаданных и случайного номера потока: тот же файл при тех же входных."""
    for bitrate in ("32k", "24k", "16k"):
        subprocess.run(
            [
                ffmpeg, "-y", "-loglevel", "error", "-i", str(source), "-map_metadata", "-1",
                "-ac", "1", "-c:a", "libopus", "-b:a", bitrate, "-application", "audio",
                "-fflags", "+bitexact", "-flags:a", "+bitexact", str(target),
            ],
            check=True,
        )
        size = target.stat().st_size
        if size <= SAMPLE_LIMIT:
            return size
    die(f"{source.name}: даже в 16 кбит/с больше 64 КБ — фраза слишком длинная")
    return 0


def ordered_character(character: dict) -> dict:
    """Поля персонажа в порядке плана: так манифесты читаются одинаково."""
    order = ["id", "gender", "color", "avatar", "prompt", "tones", "samples", "fallbackVoice", "voices", "ref", "voiceOrigin"]
    out = {key: character[key] for key in order if key in character}
    out.update({key: value for key, value in character.items() if key not in out})
    return out


def cmd_adopt(args) -> None:
    cs = clone_server(args)
    audio = voicelab_audio()
    voices = load_voices()
    state = load_state(args.character)
    if not state:
        die(f"вариантов ещё нет — сначала: design.py candidates {args.character} (или own — своя запись)")
    # Своя запись (own) — без описания голоса: в voices.json достаточно фраз-пробников, а то и их нет.
    spec = voices.setdefault("characters", {}).setdefault(args.character, {}) if state.get("own") else spec_of(voices, args.character)
    chosen = next((item for item in state["candidates"] if item["n"] == args.number), None)
    if not chosen:
        die(f"варианта {args.number} нет (есть {', '.join(str(item['n']) for item in state['candidates'])})")
    take = WORK / args.character / "candidates" / chosen["file"]
    text = state["text"]
    fits, span, verdict = reference_fit(audio, take)
    if not fits:
        die(f"вариант {args.number} не годится в образец: {verdict} — выберите другой")

    package = PACKAGES / args.character
    manifest_path = package / "manifest.json"
    if not manifest_path.exists():
        die(f"нет {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    characters = manifest.get("contributes", {}).get("characters", [])
    wanted = args.in_package or args.character
    index = next((i for i, c in enumerate(characters) if c.get("id") == wanted), 0 if len(characters) == 1 else None)
    if index is None:
        die(f"в пакете {args.character} нет персонажа «{wanted}» — укажите --in-package")

    if args.engines:
        engines = [e.strip() for e in args.engines.split(",") if e.strip()]
        for engine in engines:
            if engine not in ENGINES:
                die(f"модель «{engine}»: есть {', '.join(ENGINES)}")
            if not engine_ready(cs, engine):
                die(f"{engine} не установлен в {cs / 'runtime' / engine}")
    else:
        engines = [e for e in ENGINES if engine_ready(cs, e)]
        for engine in ENGINES:
            if engine not in engines:
                say(f"  {engine} не установлен — снимок под него снимет сам шлюз из ref.wav, когда модель встанет")
    if not engines:
        die("ни одной модели в clone-server/runtime — нечем снять голос")

    phrases = [p.strip() for p in (spec.get("samples") or []) if isinstance(p, str) and p.strip()][:MAX_SAMPLES]
    ffmpeg = shutil.which("ffmpeg")
    if phrases and not ffmpeg:
        die("нужен ffmpeg с libopus — фразы-пробники кладутся в пакет в Opus")
    voice_engine = engines[0]

    folder = WORK / args.character
    imprints = folder / "imprint"
    shutil.rmtree(imprints, ignore_errors=True)
    imprints.mkdir(parents=True)
    knows_words = "--ref-text" in (cs / "imprint.py").read_text(encoding="utf-8")
    words = None if knows_words else WordsServer(text)
    say(f"Вариант {args.number}: речь {span:.1f} с, «{text}»")
    try:
        for engine in engines:
            runtime = cs / "runtime" / engine
            command = [
                str(env_python(runtime)), str(cs / "imprint.py"),
                "--engine", engine, "--runtime", str(runtime),
                "--takes", str(take), "--out", str(imprints / engine),
                "--name", f"{manifest.get('title', args.character)} (пакет)",
                "--device", args.imprint_device,
                # Образец — весь вариант: короче любой его кусок, длиннее ничего нет.
                "--shortest", f"{max(1.0, span - SPAN_SLACK):.2f}", "--longest", f"{span + SPAN_SLACK:.2f}",
                "--samples", json.dumps(phrases if engine == voice_engine else [], ensure_ascii=False),
            ]
            command += ["--ref-text", text] if knows_words else ["--asr-url", words.url]
            if args.mem_limit_mb:
                command += ["--mem-limit-mb", str(args.mem_limit_mb)]
            run_imprint(command, engine, imprints / f"{engine}.log")
            meta = json.loads((imprints / engine / "meta.json").read_text(encoding="utf-8"))
            if meta.get("reference", {}).get("words") != text:
                die(f"{engine}: слова образца не те ({meta.get('reference', {}).get('words')!r})")
    finally:
        if words:
            words.close()

    # Всё новое — сначала рядом, потом на место: пакет не останется наполовину.
    staging = folder / "staging"
    shutil.rmtree(staging, ignore_errors=True)
    (staging / "voices").mkdir(parents=True)
    (staging / "samples").mkdir()
    shutil.copyfile(imprints / voice_engine / "ref.wav", staging / "voices" / "ref.wav")
    for engine in engines:
        shutil.copyfile(imprints / engine / "voice.pt", staging / "voices" / f"{engine}.pt")
    samples = []
    for number, phrase in enumerate(phrases, start=1):
        size = to_opus(ffmpeg, imprints / voice_engine / "samples" / f"{number}.wav", staging / "samples" / f"{number}.opus")
        samples.append({"text": phrase, "file": f"samples/{number}.opus"})
        say(f"  фраза {number}: {size / 1024:.1f} КБ — «{phrase}»")

    assets = package / "assets"
    for name in ("voices", "samples"):
        shutil.rmtree(assets / name, ignore_errors=True)
        shutil.move(str(staging / name), str(assets / name))
    shutil.rmtree(staging, ignore_errors=True)
    if not samples:
        shutil.rmtree(assets / "samples", ignore_errors=True)

    revisions = {engine: revision(cs, engine) for engine in engines}
    character = dict(characters[index])
    character["samples"] = samples
    character["voices"] = {engine: {"file": f"voices/{engine}.pt", "model": revisions[engine]} for engine in engines}
    character["ref"] = {"file": "voices/ref.wav", "text": text}
    character["voiceOrigin"] = chosen.get("origin", "synthetic")
    characters[index] = ordered_character(character)
    write_json(manifest_path, manifest)

    spec["adopted"] = {
        "origin": chosen.get("origin", "synthetic"),
        "candidate": chosen["n"],
        "seed": chosen["seed"],
        "instruct": chosen["instruct"],
        "speed": chosen.get("speed"),
        "temperature": chosen.get("temperature"),
        "models": revisions,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    write_json(VOICES_FILE, voices)

    total = sum(p.stat().st_size for p in package.rglob("*") if p.is_file())
    say(f"\n✓ {args.character}: {', '.join(f'{e} @ {r}' for e, r in revisions.items())}, ref.wav, {len(samples)} фраз; пакет {total / 1024:.0f} КБ")
    if total >= 1024 * 1024:
        say("  ! пакет 1 МБ и больше — каталог его не примет; укоротите фразы или образец")
    say("Дальше: послушать assets/samples/*.opus → node tools/build.mjs → коммит (уже опубликованный пакет — новая version).")


def cmd_own(args) -> None:
    """Своя запись вместо голоса по описанию: голос человека, который дал на это согласие, — вариант 1 для adopt."""
    clone_server(args)
    audio = voicelab_audio()
    voices = load_voices()
    source = Path(args.file).expanduser()
    if not source.is_file():
        die(f"нет файла {source}")
    text = (args.text or "").strip()
    if not text:
        die("--text: слова, которые сказаны в записи, дословно")
    if not args.consent:
        die("--consent: голос в каталоге — только с согласия того, чей он (свой — тоже подтвердите)")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        die("нужен ffmpeg: brew install ffmpeg")
    candidates = WORK / args.character / "candidates"
    shutil.rmtree(candidates, ignore_errors=True)
    candidates.mkdir(parents=True, exist_ok=True)
    name = "01.wav"
    # Любой звук (m4a с телефона, mp3, wav) → 24 кГц, моно, 16 бит — как образцы шлюза.
    subprocess.run(
        [ffmpeg, "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "24000", "-sample_fmt", "s16", str(candidates / name)],
        check=True,
    )
    samples, rate = audio.read_wav(candidates / name)
    fits, span, verdict = reference_fit(audio, candidates / name)
    manifest = PACKAGES / args.character / "manifest.json"
    title = json.loads(manifest.read_text(encoding="utf-8")).get("title") if manifest.exists() else args.character
    state = {
        "character": args.character,
        "title": title,
        "text": text,
        "language": voices.get("language", "ru"),
        "own": True,
        "candidates": [
            {
                "n": 1,
                "file": name,
                "seed": 0,
                "instruct": "своя запись",
                "speed": None,
                "temperature": None,
                "seconds": round(len(samples) / rate, 2),
                "speech": round(span, 2),
                "fits": fits,
                "verdict": verdict,
                "origin": "consent",
            }
        ],
    }
    write_json(state_path(args.character), state)
    write_listening_page(args.character, state)
    say(f"{args.character}: запись {span:.1f} с речи — {verdict}")
    if fits:
        say(f"Дальше: python3 tools/design.py adopt {args.character} 1")
    else:
        say("Перезапишите: 5–8 секунд речи одной фразой, без пауз длиннее 0,7 с, в тишине.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Голоса персонажей по описанию (OmniVoice voice design)")
    parser.add_argument("--clone-server", help="папка clone-server шлюза (по умолчанию ../voice-gateway-server/clone-server)")
    sub = parser.add_subparsers(dest="command", required=True)

    make = sub.add_parser("candidates", help="варианты фразы образца по описанию голоса")
    make.add_argument("character", help="id пакета-персонажа (как в voices.json)")
    make.add_argument("--count", type=int, default=10)
    make.add_argument("--instruct", help="описание голоса вместо voices.json, например «male, elderly, low pitch»")
    make.add_argument("--text", help="другая фраза образца (тогда --fresh)")
    make.add_argument("--speed", type=float, default=None, help="темп: меньше 1 — медленнее")
    make.add_argument("--temperature", type=float, default=None, help="class_temperature OmniVoice: больше — разнообразнее")
    make.add_argument("--seed", type=int, default=1000, help="зерно варианта N — seed + N")
    make.add_argument("--device", default="auto", help="auto | mps | cuda | cpu")
    make.add_argument("--fresh", action="store_true", help="стереть прежние варианты")
    make.set_defaults(run=cmd_candidates)

    mine = sub.add_parser("own", help="своя запись (свой голос или диктора с согласия) вместо вариантов по описанию")
    mine.add_argument("character", help="id пакета-персонажа")
    mine.add_argument("file", help="запись: wav, m4a, mp3 — 5–8 секунд речи одной фразой")
    mine.add_argument("--text", required=True, help="что сказано в записи, слово в слово")
    mine.add_argument("--consent", action="store_true", help="голос мой или его хозяин согласен на каталог")
    mine.set_defaults(run=cmd_own)

    adopt = sub.add_parser("adopt", help="выбранный вариант → снимки, ref.wav, фразы и манифест пакета")
    adopt.add_argument("character")
    adopt.add_argument("number", type=int, help="номер варианта из candidates")
    adopt.add_argument("--engines", help="через запятую; по умолчанию все установленные из omnivoice, cosyvoice3")
    adopt.add_argument("--in-package", help="id персонажа внутри пакета, если их там несколько")
    adopt.add_argument("--imprint-device", default="cpu", help="на процессоре снимок берёт вдвое меньше памяти")
    adopt.add_argument("--mem-limit-mb", type=int, default=0, help="потолок памяти imprint.py")
    adopt.set_defaults(run=cmd_adopt)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
