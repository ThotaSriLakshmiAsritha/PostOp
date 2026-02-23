export function openGmailCompose(to: string, subject = '', body = '') {
  const base = 'https://mail.google.com/mail/?view=cm&fs=1';
  const params = new URLSearchParams();
  if (to) params.set('to', to);
  if (subject) params.set('su', subject);
  if (body) params.set('body', body);
  const url = `${base}&${params.toString()}`;
  window.open(url, '_blank');
}
