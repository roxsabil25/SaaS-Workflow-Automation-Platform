-- Quick fix for XAMPP / phpMyAdmin (keeps existing data)
-- 1. Open http://localhost/phpmyadmin
-- 2. Click database: custom_docx
-- 3. Click Import tab
-- 4. Choose this file and click Go

USE `custom_docx`;

CREATE TABLE IF NOT EXISTS `sites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  UNIQUE KEY `uniq_org_site_name` (`organization_id`,`name`),
  CONSTRAINT `sites_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `users`
  ADD COLUMN `site` text DEFAULT NULL;

ALTER TABLE `invited_users`
  ADD COLUMN `site` text DEFAULT NULL;
