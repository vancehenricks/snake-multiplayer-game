include .env

.PHONY: help start-dev start extract-port

.DEFAULT_GOAL := help

help: # Display this help
	@grep -E '^[a-zA-Z0-9 -]+:.*#'  Makefile | sort | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done

start-dev: # Run development setup
	@echo "Setting up development environment..."
	@echo "var ADDR = 'ws://localhost:${PORT}';" > client/public/config.js
	@npm run start:dev

start: # Run production setup
	@echo "Setting up production environment..."
	@echo "var ADDR = 'wss://snekpvp.lol';" > client/public/config.js
	@npm ci
	@npm run start

up: # Start the docker containers
	@docker compose up -d

down: # Stop the docker containers
	@docker compose down

destroy: # Stop and remove the docker containers
	@docker compose down -v