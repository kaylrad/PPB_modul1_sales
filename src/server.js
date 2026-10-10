import app from './index.js';

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Library Loans API berjalan di http://localhost:${port}`));
