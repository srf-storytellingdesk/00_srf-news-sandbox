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

## Copy to template

To adapt any generated inside the SRF news template, run this code (the repos are required to be "directory siblings"):

```node
cp ./template/index.html ../00_srf-news-template/index.html
cp -R ./template/public/sandbox-assets ../00_srf-news-template/public
cp ./theme-override/themeVariables.scss ../00_srf-news-template/src/assets/styles/cmsOverrides
```