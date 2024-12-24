
.PHONY: start-dev start extract-port

extract-env-variables:
	@$(eval PORT=$(shell grep ^PORT= .env | cut -d '=' -f 2))

start-dev: extract-env-variables
	@echo "Setting up development environment..."
	@echo "var ADDR = 'ws://localhost:$(PORT)';" > client/public/config.js
	@npm run start:dev

start: extract-env-variables
	@echo "Setting up production environment..."
	@echo "var ADDR = 'wss://snekpvp.lol:$(PORT)';" > client/public/config.js
	@npm run start