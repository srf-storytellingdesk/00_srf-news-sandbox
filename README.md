# SRF News Sandbox

Sandbox Generator for SRF Sandbox including

- Template Generator: download styles and assets of SRF article page – or those of RTS, RSI, RTR and swissinfo.
- Theme Generator: parse darkmode styles from SRF article page and replace color values with theme variables (`pnpm theme`)
 

## Template Generator

- Run `pnpm template` for srf.ch (or `pnpm template {brand}` for the brands `rts`, `rsi`, `rtr` or `swi`)
- Run `pnpm dev {brand}` to test the template locally
- Run `pnpm copy-template {brand} {destination}` to copy generated template assets (including the html file) to SRF news template (or forks of it, in either case they are required to be "directory siblings" to this repo), i.e. `pnpm copy-template srf 26-001_my-project`.


## Theme Generator

- Run `pnpm theme`
- Copy `theme-override/themeVariables.scss` to `src/asset/styles/cmsOverrides/themeVariables.scss` of SRF news template


## Copy theme variables to template

To adapt generated theme variables and copy the file to SRF news template, run this code (the repos are required to be "directory siblings"):

```sh
cp ./theme-override/themeVariables.scss ../00_srf-news-template/src/assets/styles/cmsOverrides
```