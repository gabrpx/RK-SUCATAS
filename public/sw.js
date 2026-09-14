// Service Worker de push — só isso, de propósito: nenhum cache de assets,
// nenhuma lógica de PWA offline. O único trabalho dele é ficar vivo em
// background pra receber `push` mesmo com a aba fechada e mostrar a
// notificação nativa do sistema operacional.
self.addEventListener('push', (event) => {
  let payload = { titulo: 'RK Sucatas', corpo: '' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Payload não veio em JSON (não deveria acontecer, backend sempre manda
    // JSON.stringify) — mostra algo genérico em vez de quebrar silenciosamente.
  }

  // Sem ícone de propósito: o projeto não tem nenhum asset de ícone/favicon
  // hoje (nem o Capacitor/Android usa PNG solto em public/) — o navegador
  // mostra a notificação sem ícone em vez de tentar carregar um path que não
  // existe. Se um ícone for adicionado no futuro, referenciar aqui.
  const titulo = payload.titulo || 'RK Sucatas';
  const opcoes = {
    body: payload.corpo || '',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Clique na notificação: foca uma aba já aberta do sistema se existir, senão
// abre uma nova na rota que veio no payload.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
