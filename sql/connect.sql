USE CanteenPoDB;
GO

ALTER LOGIN canteen_user WITH PASSWORD = '2227';
GO

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'canteen_user')
    CREATE USER canteen_user FOR LOGIN canteen_user;
GO

EXEC sp_addrolemember 'db_owner', 'canteen_user';
GO