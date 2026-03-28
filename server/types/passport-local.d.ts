import "passport-local";

declare module "passport-local" {
  interface IVerifyOptions {
    field?: "email" | "password";
  }
}

export {};
