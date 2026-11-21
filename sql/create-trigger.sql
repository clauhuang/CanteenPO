CREATE TRIGGER trg_UpdateStock
ON OrderDetails
AFTER INSERT
AS
BEGIN
    UPDATE Menu
    SET Stock = Stock - i.Quantity
    FROM Menu m
    JOIN inserted i ON m.MenuID = i.MenuID;
END;
GO