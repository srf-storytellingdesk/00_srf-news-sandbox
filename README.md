# SRF News Sandbox

Sandbox Generator for SRF Sandbox including

- Template Generator: download styles and assets of SRF article page (`pnpm template`)
- Theme Generator: parse darkmode styles from SRF article page and replace color values with theme variables (`pnpm theme`)
 

## Template Generator

- Run `pnpm template`
- Copy files from `template/public` into `public` of SRF news template (or its fork)
- Copy `template/index.html` to root of SRF news template


## Theme Generator

- Run `pnpm theme`
- Copy `theme-override/themeVariables.scss` to `src/asset/styles/cmsOverrides/themeVariables.scss` of SRF news template

