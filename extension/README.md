# Extensão Chrome — Vídeo em Foco

Esta extensão importa a transcrição que o YouTube já disponibiliza na aba atual e a entrega ao Vídeo em Foco. Ela não baixa áudio nem tenta acessar legendas pelo servidor do YouTube.

## Instalar no Chrome

1. Execute o app: `npm run dev`.
2. Abra `chrome://extensions` no Google Chrome.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione esta pasta: `extension`.
6. Fixe a extensão na barra do Chrome, se desejar.

Após uma atualização desta pasta, volte a chrome://extensions e clique no ícone de recarregar da extensão. Em seguida, abra o popup para confirmar o endereço do app antes de importar.

## Usar

1. Abra um vídeo do YouTube no Chrome e, se necessário, clique em **Mostrar transcrição** na descrição. A extensão reconhece tanto o painel clássico quanto o painel novo do YouTube.
2. Clique no ícone da extensão e em **Importar desta aba**.
3. A extensão abre o Vídeo em Foco e a análise é iniciada automaticamente.

Em novas instalações, o endereço padrão é o app publicado: `https://video-em-foco.werneyal.chatgpt.site/`. Assim, os vídeos importados são salvos na coleção da versão publicada. Se a extensão já estava instalada com o localhost configurado, altere o campo no popup uma vez antes de importar.

Para desenvolvimento local, troque o endereço no popup para `http://localhost:3000/`. No navegador integrado do Codex, use `http://127.0.0.1:3000/`. A coleção local é separada da coleção publicada.

## Privacidade e limites

A transcrição fica apenas no armazenamento de sessão do Chrome, por até 10 minutos, e é removida assim que o app a recebe. A extensão lê somente a página ativa do YouTube quando você aciona o botão. Se o YouTube não exibir a transcrição para a sua conta ou para aquele vídeo, abra manualmente **Mostrar transcrição** e tente de novo.

