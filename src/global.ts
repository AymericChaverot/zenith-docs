import type { RouteData } from './route-data';

declare global {
  namespace App {
    interface Locals {
      /** Data for the docs page being rendered. */
      zenith: RouteData;
    }
  }
}

export {};
