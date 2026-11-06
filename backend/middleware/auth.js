import { protect, authorize, ROLES } from "./authRole.js";

export const auth = protect;
export { protect, authorize, ROLES };
