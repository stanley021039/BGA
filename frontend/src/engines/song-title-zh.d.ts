declare const api: {
  titles: Readonly<Record<string, string>>;
  hint(title: string, language?: string): string | undefined;
  decorate(node: HTMLElement, title: string, language?: string): HTMLElement;
};
export default api;
