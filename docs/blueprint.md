# Crypto Gas Pool Contribution Tracker — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that collects cryptocurrency payments to a shared gas pool, tracks individual contributor balances, and provides owner monitoring capabilities with manual verification of external transactions.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- crypto contributors
- gas pool owner

## Success criteria

- Contributor balance tracking with transaction history
- Owner notifications for new contributions
- Single destination wallet management

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Display pool purpose, total balance, and quick actions
- **Contribute** (button, actor: user, callback: contribute:start) — Show destination wallet address and payment options
- **My Balance** (button, actor: user, callback: balance:view) — Display user's contribution history and total
- **/admin** (command, actor: owner, command: /admin) — Access owner controls (requires authentication)

## Flows

### Contribution Flow
_Trigger:_ contribute:start

1. Display destination address and supported currencies
2. User confirms payment with amount/currency/TX hash
3. Verify and record contribution

_Data touched:_ Contribution, Payer

### Owner Admin Flow
_Trigger:_ /admin

1. Authenticate owner
2. Display contributor list and pool balance
3. Allow CSV export and address management

_Data touched:_ OwnerSettings, Contribution

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Payer** _(retention: persistent)_ — Telegram user contributing to the pool
  - fields: telegram_id, display_name
- **Contribution** _(retention: persistent)_ — Recorded payment with verification data
  - fields: amount, currency, timestamp, tx_hash
- **OwnerSettings** _(retention: persistent)_ — Administrative configuration
  - fields: destination_address, admin_chat_id, supported_currencies

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set destination wallet address
- Verify contributions by TX hash
- Export contribution CSV
- Configure supported currencies

## Notifications

- Admin notifications for new contributions
- Balance threshold alerts (configurable)

## Permissions & privacy

- Telegram user ID is stored for balance tracking
- TX hashes are stored for verification
- No personal data collected beyond what's necessary

## Edge cases

- Duplicate payments from same user
- Invalid TX hash verification
- Currency not in supported list

## Required tests

- End-to-end contribution confirmation flow
- Owner authentication and CSV export
- Balance calculation with multiple currencies

## Assumptions

- Single destination address model
- Manual verification as default
- Supported currencies list is owner-configurable
