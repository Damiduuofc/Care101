// declarations.d.ts
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'react-datepicker';