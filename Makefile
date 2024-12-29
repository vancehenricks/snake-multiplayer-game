
.PHONY: start-dev start extract-port

extract-env-variables:
	@$(eval PORT=$(shell grep ^PORT= .env | cut -d '=' -f 2))

start-dev: extract-env-variables
	@echo "Setting up development environment..."
	@echo "var ADDR = 'ws://localhost:$(PORT)';" > client/public/config.js
	@npm run start:dev

start: extract-env-variables
	@echo "Setting up production environment..."
	@echo "var ADDR = 'ws://snekpvp.lol:$(PORT)';" > client/public/config.js
	@npm ci
	@npm run start

up:
	@docker compose up -d

down: 
	@docker compose down

destroy:
	@docker compose down -v