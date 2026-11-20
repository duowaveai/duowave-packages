// Файлы, которые сборка Remotion отдаёт адресом (asset/resource): шрифты и картинки пакета.
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
