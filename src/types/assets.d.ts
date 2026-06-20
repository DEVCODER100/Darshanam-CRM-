// Ambient declarations so `tsc --noEmit` accepts global style side-effect imports.
// Next.js handles these via webpack at build time; this keeps the type checker happy.
declare module "*.css";
