const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const salesPerformanceRouter = require('./routes/salesPerformance');
app.use('/api', salesPerformanceRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SalesPerformance backend draait op http://localhost:${PORT}/`);
});

module.exports = app;
