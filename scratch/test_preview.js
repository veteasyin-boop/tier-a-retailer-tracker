import http from 'http';

http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('HTML length:', data.length);
    console.log('Contains root element:', data.includes('id="root"'));
    console.log('Contains title:', data.includes('<title>'));
  });
}).on('error', (err) => {
  console.error('HTTP request failed:', err.message);
});
