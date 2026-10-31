-- Menu inicial do WhatsApp: arte de valores particulares enviada no submenu Particular.
-- Coluna opcional: sem valor, o bot usa /chatbot/planos-particular.jpg do próprio app
-- (public/chatbot/planos-particular.jpg). A recepção pode apontar para outra URL
-- pública (JPEG ou PNG) na aba Chatbot > Configurações.
alter table chatbot_settings
  add column if not exists particular_prices_image_url text;

comment on column chatbot_settings.particular_prices_image_url is
  'URL pública (JPEG/PNG) da arte de valores particulares do menu do WhatsApp. Nula = imagem padrão do app.';
