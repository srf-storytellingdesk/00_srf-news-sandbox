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

## Copy sandbox assets to template

To adapt generated template assets (including the html file) and copy them to SRF news template, run this code (the repos are required to be "directory siblings"):

```sh
cp ./template/index.html ../00_srf-news-template/index.html
rm -rf ../00_srf-news-template/public/sandbox-assets/*
cp -R ./template/public/sandbox-assets/* ../00_srf-news-template/public/sandbox-assets/
```

## Copy theme variables to template

To adapt generated theme variables and copy the file to SRF news template, run this code (the repos are required to be "directory siblings"):

```sh
cp ./theme-override/themeVariables.scss ../00_srf-news-template/src/assets/styles/cmsOverrides
```