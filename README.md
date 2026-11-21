# CanteenPO – Canteen Pre-Order System

A web application for pre-ordering food from a campus canteen, built as a final project for a Database course at Tunghai University.

Users can log in, browse the menu, place orders with a pickup time, view or cancel their orders, and check their order history.

## Tech Stack

- **Database:** SQL Server 2019 (managed with SSMS)
- **Backend:** Node.js + Express, connected via the `mssql` package
- **Frontend:** HTML, CSS, and vanilla JavaScript

## Database Design

Four tables: `Customers`, `Menu` (price and stock), `Orders` (date, pickup time, total, status), and `OrderDetails` (items in each order).

SQL features used:

- **Trigger** `trg_UpdateStock`: automatically reduces menu stock and recalculates the order total when an item is ordered
- **Stored procedure** `sp_GetOrdersByPhone`: looks up orders by phone number, used on the My Orders and Order History pages
- **View** `OrderSummary`: joins all four tables into one order summary
- **GROUP BY reports**: spending per customer, items sold per menu item, orders per status, and daily revenue

## How to Run

1. Run the SQL scripts in the `sql` folder in SQL Server to create the `CanteenPoDB` database.
2. Set your database login in the connection settings.
3. Install dependencies and start the server:

   ```
   npm install
   node server.js
   ```

4. Open `http://localhost:3000` in your browser.
