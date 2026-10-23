-- Local Docker only. On Cloud SQL these are created by infra/ (Terraform).
CREATE ROLE proofpocket_app LOGIN PASSWORD 'app_dev_password';
CREATE DATABASE proofpocket_test OWNER proofpocket_owner;
