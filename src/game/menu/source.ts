// Endereço do código-fonte mostrado no menu. A AGPL-3.0 (seção 13) pede que quem joga uma
// versão online modificada possa baixar o código dela: quem publica um fork aponta
// VITE_SOURCE_URL para o próprio repositório antes do build.
const DEFAULT_SOURCE_URL = 'https://github.com/drvitalaraujo/simbiose';

export function sourceUrl(fromEnv = import.meta.env.VITE_SOURCE_URL as string | undefined): string {
  const url = fromEnv?.trim();
  return url && /^https?:\/\//.test(url) ? url : DEFAULT_SOURCE_URL;
}
