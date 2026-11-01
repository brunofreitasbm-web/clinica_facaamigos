-- Menu interativo do WhatsApp: identificadores (HX...) dos Contents da Twilio criados pelo botão
-- "Criar menu interativo" em Chatbot > Configurações. Todos opcionais: nulo = texto numerado.
alter table chatbot_settings
  add column if not exists welcome_menu_content_sid text,
  add column if not exists particular_menu_content_sid text,
  add column if not exists nav_back_content_sid text,
  add column if not exists particular_actions_content_sid text;

comment on column chatbot_settings.welcome_menu_content_sid is
  'Content SID (HX...) da lista do menu principal do WhatsApp, criado pelo botão em Chatbot > Configurações. Nulo = texto numerado.';
comment on column chatbot_settings.particular_menu_content_sid is
  'Content SID da lista do submenu Particular. Nulo = texto numerado.';
comment on column chatbot_settings.nav_back_content_sid is
  'Content SID do quick-reply [Voltar ao menu]. Nulo = texto com "responda VOLTAR".';
comment on column chatbot_settings.particular_actions_content_sid is
  'Content SID do quick-reply [Agendar avaliação] [Voltar] do submenu Particular. Nulo = texto numerado.';
