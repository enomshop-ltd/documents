# Medusa Plugin Documents

A Medusa v2 plugin for generating and managing invoices, receipts, and credit notes.

## Features

- Generate PDF Invoices, Receipts, and Credit Notes
- Multiple PDF Templates (Classic, Modern, Minimal)
- Automatic generation on order placement, capture, and cancellation
- Email integration with CC support for company emails
- Admin UI for managing documents and settings

## Installation

```bash
yarn add @enomshop/documents
```

## Configuration

You need to tell Medusa to load your plugin (which includes your API routes, Admin UI, and Subscribers) AND register your custom module so that req.scope.resolve("documents") works.
Open your `medusa-config.ts` file and add the following:

```javascript
module.exports = defineConfig({
  projectConfig: {
    // ...
  },

  // 1. Register the Plugin (Loads Admin UI, API Routes, and Subscribers)
  plugins: [
    {
      resolve: "@enomshop/documents",
      options: {
        // Add any plugin-level options here if you add them in the future
      }
    }
  ],

  // 2. Register the Module (Allows req.scope.resolve("documents"))
  modules: {
    {
      resolve: "@enomshop/documents/modules/documents",
    },
    // IMPORTANT: Your plugin relies on the File and Notification modules.
    // Ensure you have providers configured for them in your main project!
    // Example:
    // [Modules.FILE]: { ... },
    // [Modules.NOTIFICATION]: { ... }
  }
})
```

## Run Database Migrations

The plugin introduces new database tables (document and document_settings). You need to run migrations in your main project so Medusa creates these tables in your Postgres database.
Run this command in your main project:

```javascript

npx medusa db:migrate

```

## Rebuild the Admin Dashboard

Because the plugin injects new React components, pages, and widgets into the Admin dashboard, you must rebuild the admin UI in your main project.

```javascript

yarn build

```

## Start the Server

Start your Medusa backend and admin dashboard:

```javascript

yarn dev

```

## Usage

The plugin automatically hooks into Medusa's event system:
- `order.placed`: Generates an invoice and sends it to the customer.
- `payment.captured`: Generates a receipt and sends it to the customer.
- `order.canceled` / `order.payment_refunded`: Generates a credit note and sends it to the customer.

You can configure the company email and default template from the Medusa Admin dashboard under Settings -> Documents.
