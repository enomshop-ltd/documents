import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: "/", // In the admin, the backend is served from the same domain
  debug: process.env.NODE_ENV === "development",
  auth: {
    type: "session",
  },
})
