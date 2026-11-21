-- Schema for Redbrick & Ridge Construction Enquiries Database
CREATE TABLE IF NOT EXISTS enquiries (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) DEFAULT '',
  postcode VARCHAR(20) NOT NULL,
  project_type VARCHAR(100) NOT NULL,
  budget_band VARCHAR(100) DEFAULT '',
  visit_pref VARCHAR(100) DEFAULT '',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'New Enquiry',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
