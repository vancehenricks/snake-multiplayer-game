include .env

.PHONY: start-dev start extract-port

start-dev:
	@echo "Setting up development environment..."
	@echo "var ADDR = 'ws://localhost:${PORT}';" > client/public/config.js
	@npm run start:dev

start:
	@echo "Setting up production environment..."
	@echo "var ADDR = 'wss://snekpvp.lol';" > client/public/config.js
	@npm ci
	@npm run start

up:
	@docker compose up -d

down: 
	@docker compose down

destroy:
	@docker compose down -v