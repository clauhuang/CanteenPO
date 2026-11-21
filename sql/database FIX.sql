USE master;
GO

ALTER DATABASE CanteenPoDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

DROP DATABASE CanteenPoDB;
GO

CREATE DATABASE CanteenPoDB;
GO

USE CanteenPoDB;
GO

CREATE TABLE Customers (
    CustID INT PRIMARY KEY IDENTITY(1,1),
    CustName VARCHAR(50) NOT NULL,
    PhoneNum VARCHAR(15)
);

CREATE TABLE Menu (
    MenuID INT PRIMARY KEY IDENTITY(1,1),
    MenuName VARCHAR(100) NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    Stock INT NOT NULL
);

CREATE TABLE Orders (
    OrderID INT PRIMARY KEY IDENTITY(1,1),
    CustID INT,
    OrderDate DATE,
    PickupTime TIME,
    TotalPrice DECIMAL(10,2),
    Status VARCHAR(20) CHECK (Status IN ('Pending', 'Completed', 'Cancelled')),
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustID) REFERENCES Customers(CustID)
);

CREATE TABLE OrderDetails (
    DetailID INT PRIMARY KEY IDENTITY(1,1),
    OrderID INT NOT NULL,
    MenuID INT NOT NULL,
    Quantity INT NOT NULL,
    Subtotal DECIMAL(10,2),
    FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
    FOREIGN KEY (MenuID) REFERENCES Menu(MenuID)
);

IF OBJECT_ID('trg_UpdateStock', 'TR') IS NOT NULL
    DROP TRIGGER trg_UpdateStock;
GO

CREATE TRIGGER trg_UpdateStock
ON OrderDetails
AFTER INSERT
AS
BEGIN
    UPDATE Menu
    SET Stock = Stock - i.Quantity
    FROM Menu m
    JOIN inserted i ON m.MenuID = i.MenuID;

    UPDATE Orders
    SET TotalPrice = (
        SELECT SUM(Subtotal)
        FROM OrderDetails
        WHERE OrderID = i.OrderID
    )
    FROM Orders o
    JOIN inserted i ON o.OrderID = i.OrderID;
END;
GO

INSERT INTO Customers (CustName, PhoneNum)
VALUES
('Claudia', '0912345678'),
('Ashley', '0922222222'),
('Bob', '0933333333');

INSERT INTO Menu (MenuName, Price, Stock)
VALUES
('Shredded Chicken Rice', 60.00, 50),
('Mexico Taco Beef Rice', 90.00, 30),
('Grilled Meat Rice', 100.00, 40);

INSERT INTO Orders (CustID, OrderDate, PickupTime, TotalPrice, Status)
VALUES
(1, '2026-05-15', '12:00', 0.00, 'Pending'),
(2, '2026-05-15', '13:00', 0.00, 'Completed'),
(3, '2026-05-16', '11:30', 0.00, 'Pending');

INSERT INTO OrderDetails (OrderID, MenuID, Quantity, Subtotal)
VALUES
(1, 1, 2, 120.00),
(2, 2, 1, 90.00),
(3, 3, 3, 300.00);

IF OBJECT_ID('OrderSummary', 'V') IS NOT NULL
    DROP VIEW OrderSummary;
GO

CREATE VIEW OrderSummary AS
SELECT 
    o.OrderID,
    c.CustName,
    m.MenuName,
    od.Quantity,
    (od.Quantity * m.Price) AS Subtotal,
    o.TotalPrice,
    o.OrderDate,
    o.Status
FROM Orders o
JOIN Customers c ON o.CustID = c.CustID
JOIN OrderDetails od ON o.OrderID = od.OrderID
JOIN Menu m ON od.MenuID = m.MenuID;
GO

SELECT * FROM Customers;
SELECT * FROM Menu;
SELECT * FROM Orders;
SELECT * FROM OrderDetails;

SELECT 
    o.OrderID,
    c.CustName,
    m.MenuName,
    od.Quantity,
    (od.Quantity * m.Price) AS Subtotal,
    o.Status
FROM Orders o
JOIN Customers c ON o.CustID = c.CustID
JOIN OrderDetails od ON o.OrderID = od.OrderID
JOIN Menu m ON od.MenuID = m.MenuID;

SELECT 
    c.CustName,
    SUM(od.Quantity * m.Price) AS TotalSpent
FROM Customers c
JOIN Orders o ON c.CustID = o.CustID
JOIN OrderDetails od ON o.OrderID = od.OrderID
JOIN Menu m ON od.MenuID = m.MenuID
GROUP BY c.CustName;

SELECT 
    m.MenuName,
    SUM(od.Quantity) AS TotalSold
FROM Menu m
JOIN OrderDetails od ON m.MenuID = od.MenuID
GROUP BY m.MenuName
ORDER BY TotalSold DESC;

SELECT 
    Status,
    COUNT(OrderID) AS TotalOrders
FROM Orders
GROUP BY Status;

SELECT 
    OrderDate,
    COUNT(OrderID) AS TotalOrders,
    SUM(TotalPrice) AS DailyRevenue
FROM Orders
GROUP BY OrderDate
ORDER BY OrderDate;

SELECT * FROM OrderSummary;

IF OBJECT_ID('sp_GetOrdersByPhone', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetOrdersByPhone;
GO

CREATE PROCEDURE sp_GetOrdersByPhone
    @PhoneNum VARCHAR(15)
AS
BEGIN
    SELECT 
        o.OrderID,
        c.CustName,
        c.PhoneNum,
        CONVERT(VARCHAR, o.OrderDate, 23) AS OrderDate,
        CONVERT(VARCHAR, o.PickupTime, 8) AS PickupTime,
        o.TotalPrice,
        o.Status
    FROM Orders o
    JOIN Customers c ON o.CustID = c.CustID
    WHERE c.PhoneNum = @PhoneNum
    ORDER BY o.OrderID DESC;
END;
GO