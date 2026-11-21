const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  server: 'LAPTOP-65PPUK05\\SQLSERVER2019',
  database: 'CanteenPoDB',
  user: 'canteen_user',
  password: '2227',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();
pool.on('error', err => console.error('❌ DB Pool error:', err.message));
poolConnect.then(() => console.log('✅ Connected to SQL Server!')).catch(err => console.error('❌ DB Connection failed:', err.message));
async function getPool() { await poolConnect; return pool; }

app.get('/api/menu', async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(`SELECT * FROM Menu ORDER BY MenuID`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/menu', async (req, res) => {
  const { MenuName, Price, Stock } = req.body;
  try {
    const p = await getPool();
    const result = await p.request()
      .input('MenuName', sql.VarChar, MenuName)
      .input('Price', sql.Decimal(10,2), Price)
      .input('Stock', sql.Int, Stock)
      .query(`INSERT INTO Menu (MenuName,Price,Stock) OUTPUT INSERTED.* VALUES (@MenuName,@Price,@Stock)`);
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/menu/:id', async (req, res) => {
  const { MenuName, Price, Stock } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input('MenuName', sql.VarChar, MenuName)
      .input('Price', sql.Decimal(10,2), Price)
      .input('Stock', sql.Int, Stock)
      .input('MenuID', sql.Int, parseInt(req.params.id))
      .query(`UPDATE Menu SET MenuName=@MenuName,Price=@Price,Stock=@Stock WHERE MenuID=@MenuID`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/menu/:id', async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input('MenuID', sql.Int, parseInt(req.params.id))
      .query(`DELETE FROM Menu WHERE MenuID=@MenuID`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/customers', async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(`
      SELECT c.*, COUNT(o.OrderID) AS OrderCount
      FROM Customers c
      LEFT JOIN Orders o ON c.CustID=o.CustID
      GROUP BY c.CustID, c.CustName, c.PhoneNum
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/customers', async (req, res) => {
  const { CustName, PhoneNum } = req.body;
  try {
    const p = await getPool();
    const result = await p.request()
      .input('CustName', sql.VarChar, CustName)
      .input('PhoneNum', sql.VarChar, PhoneNum)
      .query(`INSERT INTO Customers (CustName,PhoneNum) OUTPUT INSERTED.* VALUES (@CustName,@PhoneNum)`);
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/customers/:id', async (req, res) => {
  const { CustName, PhoneNum } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input('CustName', sql.VarChar, CustName)
      .input('PhoneNum', sql.VarChar, PhoneNum)
      .input('CustID', sql.Int, parseInt(req.params.id))
      .query(`UPDATE Customers SET CustName=@CustName,PhoneNum=@PhoneNum WHERE CustID=@CustID`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input('CustID', sql.Int, parseInt(req.params.id))
      .query(`DELETE FROM Customers WHERE CustID=@CustID`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders', async (req, res) => {
  const status = req.query.status;
  const phone  = req.query.phone;
  try {
    const p = await getPool();
    const r = p.request();
    let q = `SELECT o.OrderID,
         CONVERT(VARCHAR,o.OrderDate,23) AS OrderDate,
         CONVERT(VARCHAR,o.PickupTime,8) AS PickupTime,
         o.TotalPrice, o.Status,
         c.CustName, c.PhoneNum
         FROM Orders o JOIN Customers c ON o.CustID=c.CustID`;    const conditions = [];
    if (status && status !== 'all') {
      r.input('Status', sql.VarChar, status);
      conditions.push(`o.Status=@Status`);
    }
    if (phone) {
      r.input('Phone', sql.VarChar, phone);
      conditions.push(`c.PhoneNum=@Phone`);
    }
    if (conditions.length) q += ` WHERE ` + conditions.join(' AND ');
    q += ` ORDER BY o.OrderID DESC`;
    const result = await r.query(q);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/by-phone/:phone', async (req, res) => {
  const phone = req.params.phone;
  try {
    const p = await getPool();
    const result = await p.request()
      .input('PhoneNum', sql.VarChar, phone)
      .execute('sp_GetOrdersByPhone');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
  const { CustName, PhoneNum, OrderDate, PickupTime, Status, items } = req.body;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const checkCust = await new sql.Request(transaction)
      .input('PhoneNum', sql.VarChar, PhoneNum)
      .query(`SELECT CustID FROM Customers WHERE PhoneNum=@PhoneNum`);

    let custId;
    if (checkCust.recordset.length > 0) {
      custId = checkCust.recordset[0].CustID;
    } else {
      const newCust = await new sql.Request(transaction)
        .input('CustName', sql.VarChar, CustName)
        .input('PhoneNum', sql.VarChar, PhoneNum)
        .query(`INSERT INTO Customers (CustName,PhoneNum) OUTPUT INSERTED.CustID VALUES (@CustName,@PhoneNum)`);
      custId = newCust.recordset[0].CustID;
    }

    const newOrder = await new sql.Request(transaction)
      .input('CustID', sql.Int, custId)
      .input('OrderDate', sql.Date, OrderDate)
      .input('PickupTime', sql.VarChar, PickupTime)
      .input('Status', sql.VarChar, Status)
      .query(`INSERT INTO Orders (CustID,OrderDate,PickupTime,TotalPrice,Status)
              OUTPUT INSERTED.OrderID
              VALUES (@CustID,@OrderDate,@PickupTime,0.00,@Status)`);

    const orderId = newOrder.recordset[0].OrderID;

    for (const item of items) {
      await new sql.Request(transaction)
        .input('OrderID', sql.Int, orderId)
        .input('MenuID', sql.Int, item.MenuID)
        .input('Quantity', sql.Int, item.Quantity)
        .input('Subtotal', sql.Decimal(10,2), item.Subtotal)
        .query(`INSERT INTO OrderDetails (OrderID,MenuID,Quantity,Subtotal)
                VALUES (@OrderID,@MenuID,@Quantity,@Subtotal)`);
    }

    await transaction.commit();
    res.json({ success: true, OrderID: orderId, CustID: custId });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { Status } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input('Status', sql.VarChar, Status)
      .input('OrderID', sql.Int, parseInt(req.params.id))
      .query(`UPDATE Orders SET Status=@Status WHERE OrderID=@OrderID`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const p = await getPool();
    const id = parseInt(req.params.id);
    await p.request().input('OrderID', sql.Int, id).query(`DELETE FROM OrderDetails WHERE OrderID=@OrderID`);
    await p.request().input('OrderID', sql.Int, id).query(`DELETE FROM Orders WHERE OrderID=@OrderID`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/order-summary', async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(`SELECT * FROM OrderSummary`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/analytics', async (req, res) => {
  try {
    const p = await getPool();
    const revenue    = await p.request().query(`SELECT COALESCE(SUM(TotalPrice),0) AS v FROM Orders`);
    const avg        = await p.request().query(`SELECT COALESCE(AVG(TotalPrice),0) AS v FROM Orders`);
    const completed  = await p.request().query(`SELECT COUNT(*) AS v FROM Orders WHERE Status='Completed'`);
    const totalItems = await p.request().query(`SELECT COALESCE(SUM(Quantity),0) AS v FROM OrderDetails`);
    const byCust     = await p.request().query(`SELECT c.CustName, COALESCE(SUM(o.TotalPrice),0) AS total FROM Customers c LEFT JOIN Orders o ON c.CustID=o.CustID GROUP BY c.CustID, c.CustName ORDER BY total DESC`);
    const byMenu     = await p.request().query(`SELECT m.MenuName, COALESCE(SUM(od.Quantity),0) AS total FROM Menu m LEFT JOIN OrderDetails od ON m.MenuID=od.MenuID GROUP BY m.MenuID, m.MenuName ORDER BY total DESC`);
    const byStatus   = await p.request().query(`SELECT Status, COUNT(*) AS total FROM Orders GROUP BY Status ORDER BY total DESC`);
    const byDate     = await p.request().query(`SELECT CONVERT(VARCHAR,OrderDate,23) AS OrderDate, SUM(TotalPrice) AS total FROM Orders GROUP BY OrderDate ORDER BY OrderDate`);
    res.json({
      stats: { revenue: revenue.recordset[0].v, avg: avg.recordset[0].v, completed: completed.recordset[0].v, totalItems: totalItems.recordset[0].v },
      byCust: byCust.recordset, byMenu: byMenu.recordset, byStatus: byStatus.recordset, byDate: byDate.recordset
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const p = await getPool();
    const revenue = await p.request().query(`SELECT COALESCE(SUM(TotalPrice),0) AS v FROM Orders WHERE Status='Completed'`);
    const orders  = await p.request().query(`SELECT COUNT(*) AS v FROM Orders`);
    const pending = await p.request().query(`SELECT COUNT(*) AS v FROM Orders WHERE Status='Pending'`);
    const menus   = await p.request().query(`SELECT COUNT(*) AS v FROM Menu`);
    const recent  = await p.request().query(`SELECT TOP 5 o.OrderID, c.CustName, o.OrderDate, o.TotalPrice, o.Status FROM Orders o JOIN Customers c ON o.CustID=c.CustID ORDER BY o.OrderID DESC`);
    const stock   = await p.request().query(`SELECT MenuName, Stock FROM Menu ORDER BY Stock DESC`);
    res.json({ revenue: revenue.recordset[0].v, orders: orders.recordset[0].v, pending: pending.recordset[0].v, menus: menus.recordset[0].v, recent: recent.recordset, stock: stock.recordset });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`CanteenPO server running at http://localhost:${PORT}`);
});