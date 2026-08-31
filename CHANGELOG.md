# Changelog

## [3.6.0](https://github.com/andrewshell/pinsquirrel/compare/v3.5.3...v3.6.0) (2026-08-31)


### Features

* **admin:** add a Users page listing active accounts ([838614d](https://github.com/andrewshell/pinsquirrel/commit/838614ddde790d4a187a8e77df980487cc9cb7fa))
* **admin:** drop the compose flow on a keyless environment ([99f383f](https://github.com/andrewshell/pinsquirrel/commit/99f383f49790c0cd8795e44d827e39636d366477))
* **admin:** edit a user's roles in place and delete from the row ([aa422ef](https://github.com/andrewshell/pinsquirrel/commit/aa422efce1d08ae588cb4942e37a97be1d6a3c18))
* **admin:** grant the Admin role from a user's row ([4777e5b](https://github.com/andrewshell/pinsquirrel/commit/4777e5b865df5d329e8311c90bd6d9dcbe1976a4))
* **admin:** let an environment run without a sealed-email key ([10ca3da](https://github.com/andrewshell/pinsquirrel/commit/10ca3da60d89601e62af147596421cd3935e75ef))
* **admin:** let the first operator claim admin on a fresh database ([84d996e](https://github.com/andrewshell/pinsquirrel/commit/84d996e1ed260389e4e0c080184d0f3f5d11d02c))
* **admin:** manage every role from the Users page ([4930c9d](https://github.com/andrewshell/pinsquirrel/commit/4930c9d1dba677ecbd3e87a7c98caf65bffec7cb))
* **admin:** put the shared header on every signed-in page ([7c77879](https://github.com/andrewshell/pinsquirrel/commit/7c77879f86c5c5bdf028d2e6de267c7b48ab28df))
* **admin:** restyle the admin app in the Neo Brutalism design ([6412b34](https://github.com/andrewshell/pinsquirrel/commit/6412b34468fa56711b22e800163692643eb4ebc0))
* **admin:** serve the logo and a dropdown script ([26a34cc](https://github.com/andrewshell/pinsquirrel/commit/26a34ccccedf7f4903595b6fea14e67e05b8f080))
* **admin:** ship the PinSquirrel favicons ([36969b8](https://github.com/andrewshell/pinsquirrel/commit/36969b84db9baf28a3b078f501d4b560ca16f757))
* **chrome-extension:** add a "Selected only" toggle to the tag list ([0cd9519](https://github.com/andrewshell/pinsquirrel/commit/0cd95192c6e5c77f1c61b5390304342f923d5a56))
* **chrome-extension:** add the manifest, popup shell and entry points ([e008712](https://github.com/andrewshell/pinsquirrel/commit/e0087120e17e724cf85ede2d7965dce9a7755cea))
* **chrome-extension:** build with esbuild, copying assets named by the manifest ([75cfa1d](https://github.com/andrewshell/pinsquirrel/commit/75cfa1d304c09d91d3b804e6ba71a110475caefc))
* **chrome-extension:** narrow the tag list to the selection ([de77293](https://github.com/andrewshell/pinsquirrel/commit/de7729364fad8488d24b545e63478f31fa8b5611))
* **chrome-extension:** run the sync from the service worker ([083f967](https://github.com/andrewshell/pinsquirrel/commit/083f967fed7036acaf7101b6e4982fac4d7b59be))
* **chrome-extension:** say which of the two filters emptied the list ([529057f](https://github.com/andrewshell/pinsquirrel/commit/529057f0496561a29b39e47597c853cd375c2b13))
* **crypto:** keygen creates the key file's parent directories ([0e88c94](https://github.com/andrewshell/pinsquirrel/commit/0e88c94166cf0cdd06ebdb86b829f5720727f599))
* **database:** search tag names alongside url, title and description ([335f39f](https://github.com/andrewshell/pinsquirrel/commit/335f39f00148ce807794553b5e89689dc8f4cb7a))
* **database:** search tags by name, term by term ([cf47286](https://github.com/andrewshell/pinsquirrel/commit/cf472869ec67c90b2cbf046b97810c6a6d2677fa))
* **domain:** add UserRepository.removeRole ([70d227c](https://github.com/andrewshell/pinsquirrel/commit/70d227c2d3468e6a47bdd40aa99b7de130ac142c))
* **domain:** count the users holding a role ([f53d506](https://github.com/andrewshell/pinsquirrel/commit/f53d50670287b4eb86895e9a6242b8eedb45db3a))
* **extension:** add a connect message to the popup/worker contract ([911c4ec](https://github.com/andrewshell/pinsquirrel/commit/911c4ecd75c265ceac1c554e2781f351b8f3f8f1))
* **extension:** add authorizedFetch, the seam the API client sits on ([8459575](https://github.com/andrewshell/pinsquirrel/commit/84595750e7377c8ed011356e58d9cddefcf44122))
* **extension:** add PKCE verifier and S256 challenge helpers ([e3c9561](https://github.com/andrewshell/pinsquirrel/commit/e3c956110185bd3dd6e5d6ab50af930c52f2dabc))
* **extension:** add typed chrome.storage.local wrapper and shared types ([a4592d3](https://github.com/andrewshell/pinsquirrel/commit/a4592d33f28ea19cadcca2916a20bfc17dfa9f02))
* **extension:** build and verify the OAuth authorization request ([21aa775](https://github.com/andrewshell/pinsquirrel/commit/21aa775bb59e17c3aa1a108d00ce9d848b4bb644))
* **extension:** connect over authorization code + PKCE with dynamic registration ([108bbd9](https://github.com/andrewshell/pinsquirrel/commit/108bbd900d9b3a816f8fe97ceb2e5da548728997))
* **extension:** count the tags shown and the tags selected ([383685b](https://github.com/andrewshell/pinsquirrel/commit/383685b97eb8f3a0911cf8786f3a2cad18a74c17))
* **extension:** define the popup/worker sync message contract ([f9d30cd](https://github.com/andrewshell/pinsquirrel/commit/f9d30cdb935a7b9cac1ce5732dacc567c1d90f92))
* **extension:** discover the OAuth endpoints from the metadata documents ([7986f7b](https://github.com/andrewshell/pinsquirrel/commit/7986f7b823d441db42effa381d69d7d1ce5ba03f))
* **extension:** filter the popup's tag list as the user types ([f285dc4](https://github.com/andrewshell/pinsquirrel/commit/f285dc47690070937b022cb18d408d531a5ebcd8))
* **extension:** find or create a bookmark folder by name ([67f68e4](https://github.com/andrewshell/pinsquirrel/commit/67f68e4f154a8cc23d44e15a8b0c98adcadbb485))
* **extension:** match tags by case-insensitive substring ([325a789](https://github.com/andrewshell/pinsquirrel/commit/325a7897d0304fc013bdec14ebb88ebdbb734dec))
* **extension:** open the popup on the view the stored state calls for ([4c7bc70](https://github.com/andrewshell/pinsquirrel/commit/4c7bc705d1fbd6676bfd19392cdf69176e126a8a))
* **extension:** open the popup with the cursor in the filter box ([d934535](https://github.com/andrewshell/pinsquirrel/commit/d934535bdf678ede193f958b6b4bce9b375aa3ee))
* **extension:** parse the base URL and word the last-sync line ([318d23d](https://github.com/andrewshell/pinsquirrel/commit/318d23da698bd9db1086752f19e2fe1be5f8db2d))
* **extension:** provide an access token, refreshing it before it expires ([32c58c8](https://github.com/andrewshell/pinsquirrel/commit/32c58c8233d1c380f5e7ad307da355d72e4da0ea))
* **extension:** read a page of the pins carrying a tag ([d55c846](https://github.com/andrewshell/pinsquirrel/commit/d55c8468669bf700ed1ba4d5b679a3535ff1f4cb))
* **extension:** read the user's tags over the v1 API ([474c8e5](https://github.com/andrewshell/pinsquirrel/commit/474c8e54219421ca30eeff5dc911c74ae313d95e))
* **extension:** rebuild a sync from storage for the worker ([6dfdabd](https://github.com/andrewshell/pinsquirrel/commit/6dfdabd0f1219e4d8a0fb5df1a88ae440e038b3c))
* **extension:** reconcile a tag folder to its pins ([941749a](https://github.com/andrewshell/pinsquirrel/commit/941749a4ff2aa51f575bcd75e83ed0d2b15310d2))
* **extension:** remove the tag folders that no longer belong ([8fcc1c3](https://github.com/andrewshell/pinsquirrel/commit/8fcc1c344e9402bc0ce6e65a83f177900186a0c8))
* **extension:** render the tag checkboxes ([cd19c78](https://github.com/andrewshell/pinsquirrel/commit/cd19c78433dc3d48213decb7f8dce5bbdd13a957))
* **extension:** revoke the grant and clear storage on disconnect ([01b8368](https://github.com/andrewshell/pinsquirrel/commit/01b8368ef62ea96380b71992f62e171cd9201ee4))
* **extension:** say when a filter matched no tags ([ad7ad24](https://github.com/andrewshell/pinsquirrel/commit/ad7ad24cac685427af478ff12c41fcd9c72511ab))
* **extension:** sync every selected tag and report the run ([fdeecf7](https://github.com/andrewshell/pinsquirrel/commit/fdeecf72887543b0345d05f4aa1d6571e0ce46a2))
* **extension:** sync, select tags and disconnect from the popup ([d709f45](https://github.com/andrewshell/pinsquirrel/commit/d709f455596e38639255bdc57e67b4697be261d9))
* **extension:** turn a refused or unrecognisable answer into an error ([f463b7c](https://github.com/andrewshell/pinsquirrel/commit/f463b7c89f4f013c1704d91881c06d06c6bef402))
* **extension:** use the app favicon as the extension icon ([618556e](https://github.com/andrewshell/pinsquirrel/commit/618556e70cd65627e433960eaf67c71703b0f7b9))
* **extension:** walk every page of a tag's pins ([34b7534](https://github.com/andrewshell/pinsquirrel/commit/34b7534ca773663b8902a08bfb302a916999acd9))
* **hono:** show the tags a search matches above the pin list ([3867761](https://github.com/andrewshell/pinsquirrel/commit/38677610838a5c019bfe611797b720273657bb34))
* **mcp:** refuse a tool call that lacks its write scope ([0c26aff](https://github.com/andrewshell/pinsquirrel/commit/0c26affa4d7a9eccfb2f79914e5cf521c3bdbeea))
* **oauth:** advertise the write scopes on both protected resources ([e477af2](https://github.com/andrewshell/pinsquirrel/commit/e477af2fb06527ad2b9612a540e10293667eea29))
* **oauth:** describe the write scopes on the consent screen ([79e65c3](https://github.com/andrewshell/pinsquirrel/commit/79e65c3f4df9bba4e6cde98a5fb11a957d12ab29))
* **oauth:** grant pins:write and tags:write when a client asks ([401b4b1](https://github.com/andrewshell/pinsquirrel/commit/401b4b19c4bfd8b7e202998856e18b1ed42ef81d))
* **oauth:** let bearerChallenge phrase an insufficient_scope refusal ([ffbcfc1](https://github.com/andrewshell/pinsquirrel/commit/ffbcfc1da1b3bc05bbda48b2d136b55cc621fcf5))
* **oauth:** refuse a write route to a token without the scope ([909339b](https://github.com/andrewshell/pinsquirrel/commit/909339b1cbc18793374367607782ea49229e1d44))
* **oauth:** show one Connected Applications row per client ([b87b179](https://github.com/andrewshell/pinsquirrel/commit/b87b1794defca6cb37cf01b471f3bb7a48c66f02))
* **services:** ask whether the system has an admin yet ([bd68e2d](https://github.com/andrewshell/pinsquirrel/commit/bd68e2dc11b7869c31dab574830b2375f9b10626))
* **services:** expose tag search as TagService.searchTags ([f8590f3](https://github.com/andrewshell/pinsquirrel/commit/f8590f36cf4cc662f3b65940eea8e7de3797617f))
* **services:** let an admin delete a user account ([3f7dd3e](https://github.com/andrewshell/pinsquirrel/commit/3f7dd3e1e1b8aa7df7f1c331b3eebae0ca0518da))
* **services:** let the first signed-in user claim admin on a fresh system ([bd8fdc1](https://github.com/andrewshell/pinsquirrel/commit/bd8fdc1efe860808cd3df45828cec2797be940d6))
* **services:** make the cold start reachable from the waitlist ([6246550](https://github.com/andrewshell/pinsquirrel/commit/624655093fd2c17b23d1883f709d0e8f4d35bc34))
* **ui:** add a shared ProfileDropdown ([7afb2e5](https://github.com/andrewshell/pinsquirrel/commit/7afb2e5a4c0f5b5949ccf38cef68e658a698d202))
* **ui:** add a shared UserIcon ([50aae93](https://github.com/andrewshell/pinsquirrel/commit/50aae9358578afa7018ee92ecee6d980ccc7a47d))
* **ui:** add shared Header and NavLink ([80ebf99](https://github.com/andrewshell/pinsquirrel/commit/80ebf994621d7b9771d592642c1b09383e5612ee))
* **ui:** extract shared @pinsquirrel/ui package and render admin with it ([21e660a](https://github.com/andrewshell/pinsquirrel/commit/21e660ae35add76406c4e5a1a5c7172b2436539b))
* **ui:** give the active NavLink a filled selected state ([e8f71d8](https://github.com/andrewshell/pinsquirrel/commit/e8f71d87e574aa754c0681d849aca393f4c6ced8))


### Bug Fixes

* commit the lockfile as the happy-dom override rewrites it ([945f98c](https://github.com/andrewshell/pinsquirrel/commit/945f98c80d64d45f9d8adc9fc968751c124d93d4))
* **database:** match each search term independently ([d896492](https://github.com/andrewshell/pinsquirrel/commit/d8964924f16626a810ea3cc81704bc67bab9e4ff))
* **extension:** have the popup ask the worker to connect ([2f4c3bd](https://github.com/andrewshell/pinsquirrel/commit/2f4c3bdec76a9903939eca8552dc870956c0056c))
* **extension:** keep the tags the filter is hiding selected ([4465de7](https://github.com/andrewshell/pinsquirrel/commit/4465de797d88ddec101707ec41b9fc0c6a0f709e))
* **extension:** run the OAuth connect flow in the service worker ([13a2e8a](https://github.com/andrewshell/pinsquirrel/commit/13a2e8a0c07e8104bc7386d698f694b74d754424))
* **extension:** use the acorn favicon, not the squirrel logo, as the icon ([f5abb3c](https://github.com/andrewshell/pinsquirrel/commit/f5abb3ce03b0c6fc102aeaefb6a9a980f38479b9))
* **hono:** keep the view and read filters on a matching-tag link ([3f7f6ae](https://github.com/andrewshell/pinsquirrel/commit/3f7f6aed52b3e900ee978185d5d94b5064825873))
* **hono:** stop the Back button restoring a dimmed pin list ([5b7c069](https://github.com/andrewshell/pinsquirrel/commit/5b7c0694c55d55f2f68e7aff30aa36f268d6ff0e))
* **ui:** pin the hono/jsx runtime with per-file pragmas ([761d778](https://github.com/andrewshell/pinsquirrel/commit/761d778ef69113f65bda9dcb2e8153c730a93466))

## [3.5.3](https://github.com/andrewshell/pinsquirrel/compare/v3.5.2...v3.5.3) (2026-08-26)


### Bug Fixes

* commit the lockfile as the undici override rewrites it ([1f3e68e](https://github.com/andrewshell/pinsquirrel/commit/1f3e68e5a87b2d2645d912711a1723ddc2ee3764))

## [3.5.2](https://github.com/andrewshell/pinsquirrel/compare/v3.5.1...v3.5.2) (2026-08-26)


### Bug Fixes

* externalize every third-party dependency of the bundled workspace libs ([24a82ec](https://github.com/andrewshell/pinsquirrel/commit/24a82ecfaff39bebe309762c085218bc8041c32c))

## [3.5.1](https://github.com/andrewshell/pinsquirrel/compare/v3.5.0...v3.5.1) (2026-08-26)


### Bug Fixes

* keep mailgun.js a direct hono dependency ([18e09e3](https://github.com/andrewshell/pinsquirrel/commit/18e09e3e6cdb9705abdaa7001156cc6d4f1eec29))


## [3.5.0](https://github.com/andrewshell/pinsquirrel/compare/v3.4.1...v3.5.0) (2026-08-26)


### Features

* **admin:** give the console a session TTL, a login lockout and Secure cookies (2.33) ([e038cde](https://github.com/andrewshell/pinsquirrel/commit/e038cdea87df2468c5456a3721015654db61be43))
* **database:** add the authorization code repository ([66a8d07](https://github.com/andrewshell/pinsquirrel/commit/66a8d074f3a1895345eab6facbf4b1c3f7e2478d))
* **database:** add the OAuth tables and the client repository ([c63b6a8](https://github.com/andrewshell/pinsquirrel/commit/c63b6a8e8a4726752b462672e8140c645ebcf0e5))
* **database:** add the OAuth token repository and wire all three up ([ce55157](https://github.com/andrewshell/pinsquirrel/commit/ce551575b9e1e9f4a9b7445525f7a91cd33075ba))
* **database:** drop the api_keys table ([7f58f4c](https://github.com/andrewshell/pinsquirrel/commit/7f58f4cd28d3fa5d1e33997ecc2579853f1222ac))
* **domain:** add the OAuth client, code and token domain layer ([acd71ec](https://github.com/andrewshell/pinsquirrel/commit/acd71ec90fd7b150bbb5890ab026811c71a9210d))
* **domain:** let a fetch refuse redirects ([e72a21e](https://github.com/andrewshell/pinsquirrel/commit/e72a21ea7cef59fbc6b437c9830ad5b0950f3d05))
* **hono:** add BASE_URL config as the OAuth issuer and resource origin ([0140c0f](https://github.com/andrewshell/pinsquirrel/commit/0140c0fb365dd7961e2529c44bb5488d356df967))
* **hono:** add the OAuth bearer middleware ([6599ba6](https://github.com/andrewshell/pinsquirrel/commit/6599ba6812f909bcbd88bd1e011d234854c7678b))
* **hono:** drop the API key card from the profile page ([393ec44](https://github.com/andrewshell/pinsquirrel/commit/393ec44d0190df0c2475f3bd3c39c30ac56e9f85))
* **hono:** list and revoke connected applications on the profile page ([1e848df](https://github.com/andrewshell/pinsquirrel/commit/1e848df761e6fe83ffccc4c05f6d8951a79a3786))
* **hono:** pre-register OAuth clients from configuration ([8087537](https://github.com/andrewshell/pinsquirrel/commit/8087537706a5cfa991b905b081904d2ccba4ef62))
* **hono:** rate limit the OAuth endpoints and both protected resources ([cb1cebc](https://github.com/andrewshell/pinsquirrel/commit/cb1cebc912c8a5bdffe71e0ad71102d8bfdf7bef))
* **hono:** render the OAuth consent screen ([86d4798](https://github.com/andrewshell/pinsquirrel/commit/86d4798950dea73d03049076805d23aeaf336aee))
* **hono:** return a discoverable WWW-Authenticate challenge on 401 ([081fa6c](https://github.com/andrewshell/pinsquirrel/commit/081fa6c9665a3bf757e1d4336527b52fc5316433))
* **hono:** route /mcp and /api/v1 through OAuth, and mount the endpoints ([a85173c](https://github.com/andrewshell/pinsquirrel/commit/a85173c1c33f7a586fe71862f6d70a6c76b74d18))
* **hono:** serve the OAuth discovery documents ([503aa47](https://github.com/andrewshell/pinsquirrel/commit/503aa47a67b1a49566fc32d614779b71bde8cdb8))
* **hono:** serve the token, revocation and registration endpoints ([0a235f4](https://github.com/andrewshell/pinsquirrel/commit/0a235f46cd6512d809f46cf8a92ce045d9eee46b))
* **services:** add OAuth URI normalization and RFC 9728 path helper ([452ad43](https://github.com/andrewshell/pinsquirrel/commit/452ad4344d7430887c54d3ad87418c9e362d0169))
* **services:** exchange an authorization code for tokens ([f24fbe1](https://github.com/andrewshell/pinsquirrel/commit/f24fbe1cdaeef5af1b41bd2e380e56795047affa))
* **services:** keep the token endpoint off the CIMD fetch path ([72b773d](https://github.com/andrewshell/pinsquirrel/commit/72b773db26091e2c63d3ab4ac7307a17e8d4d9a8))
* **services:** match redirect URIs with the RFC 8252 loopback rule ([3a74bef](https://github.com/andrewshell/pinsquirrel/commit/3a74bef4ab91129676fa0dd03ecae173673961ca))
* **services:** register DCR clients, list and revoke grants ([038ca17](https://github.com/andrewshell/pinsquirrel/commit/038ca17b167f343de310e341d54e3305c9c7313a))
* **services:** resolve a bearer token to its principal ([555f4a4](https://github.com/andrewshell/pinsquirrel/commit/555f4a4bb1007a28ee7a4fedffa41e54c8c83752))
* **services:** resolve an OAuth client, CIMD first ([93950b5](https://github.com/andrewshell/pinsquirrel/commit/93950b526176bd14773ecd007ae07cf098a46b34))
* **services:** resolve and grant an authorization request ([d60973f](https://github.com/andrewshell/pinsquirrel/commit/d60973f4c575e8c21609d7979cc2f982e9126387))
* **services:** rotate refresh tokens and detect a replay ([70cd2f3](https://github.com/andrewshell/pinsquirrel/commit/70cd2f3ce6bb34debe2c3ef124cf9c4f36ba82ac))
* **services:** sweep the OAuth stores and wire the service up ([8724ece](https://github.com/andrewshell/pinsquirrel/commit/8724ecee5959082e49abc5b0454d203d5be53a98))
* **services:** validate the OAuth wire formats ([1e9d84c](https://github.com/andrewshell/pinsquirrel/commit/1e9d84c5c11bb069c195a7f76688a9aa61f2a683))
* ship a script-src 'self' Content-Security-Policy (2.18) ([28ad4e4](https://github.com/andrewshell/pinsquirrel/commit/28ad4e4547b6a7aebbc42889152def23754f0ee5))
* sweep expired sessions and reset tokens (2.5) ([d0a7dad](https://github.com/andrewshell/pinsquirrel/commit/d0a7dad7ece00d13c9824c77a0d849a00f971e0f))


### Bug Fixes

* close the /\evil.com open redirect after sign-in (1.9) ([89d8983](https://github.com/andrewshell/pinsquirrel/commit/89d89835910b27074904ed2584f960ed8604342e))
* confirm profile changes with a flash and a redirect (2.13) ([0e0b889](https://github.com/andrewshell/pinsquirrel/commit/0e0b88947b157fe58e483164d07330c6b75a4dcd))
* enforce one account per email at the database (1.6) ([77e9ac2](https://github.com/andrewshell/pinsquirrel/commit/77e9ac232ae73250fe4255ff34a906881a094249))
* escape interpolated values in the HTML email bodies (2.30) ([080ee4f](https://github.com/andrewshell/pinsquirrel/commit/080ee4f300db02eb9f56e44e9ccbc2e2c819c21d))
* escape LIKE wildcards in the pin search term (2.12) ([b961444](https://github.com/andrewshell/pinsquirrel/commit/b961444ef7be8de24d0bc93d36f7a9fd8f0455f7))
* fall back to page 1 for a non-numeric ?page (2.11) ([55e7026](https://github.com/andrewshell/pinsquirrel/commit/55e70265bf4154331dc11912780921ad18d8ef7c))
* give toggle-read the same contract as its sibling routes (2.16) ([b5c6bb5](https://github.com/andrewshell/pinsquirrel/commit/b5c6bb5c82e9846669cfc8929a2f7cdd5023dc2b))
* **hono:** build an MCP server and transport per request ([d1e8213](https://github.com/andrewshell/pinsquirrel/commit/d1e821312c039412afdd35a0b75446b74fb82ed7))
* honour forwarding headers only behind a trusted proxy (1.8) ([abda250](https://github.com/andrewshell/pinsquirrel/commit/abda25070cc11bda921039e8be066ec19252e642))
* keep the duplicate-pin link inside private mode (2.15) ([2de9ff8](https://github.com/andrewshell/pinsquirrel/commit/2de9ff811650fbb764dc649ec692e85f3cf2627f))
* make fetchOrCreateByNames survive a concurrent create (1.5) ([afa39d9](https://github.com/andrewshell/pinsquirrel/commit/afa39d93902716a9696ab06d32aeb69f36ea1be6))
* make sign-out POST-only (1.10) ([7a1a9ef](https://github.com/andrewshell/pinsquirrel/commit/7a1a9ef24c30202915cb7ba73b0181f4577f9d1b))
* match SSRF-blocked addresses by CIDR, not string prefix (1.12) ([4c3fedc](https://github.com/andrewshell/pinsquirrel/commit/4c3fedc0fbe338eb6e8ba83576da680f43912f83))
* refuse hostnames that resolve into private ranges (1.12) ([ebbffa3](https://github.com/andrewshell/pinsquirrel/commit/ebbffa3f79b130d54eb24b9e3a6bd9bc4697d5db))
* report another user's pin as missing on the public surfaces (1.11) ([82fc005](https://github.com/andrewshell/pinsquirrel/commit/82fc005149f7c881782e7d867bcc46cc28b2adab))
* report another user's pin or tag as missing over API and MCP (1.11) ([5f44477](https://github.com/andrewshell/pinsquirrel/commit/5f44477dae739f14355d556c385dd6b92439c764))
* report metadata-fetch failures in the status line (2.14) ([fde07a0](https://github.com/andrewshell/pinsquirrel/commit/fde07a031c837d0ee4c4782e750e80d31b1c7727))
* restrict pin urlSchema to http and https (1.7) ([faf9902](https://github.com/andrewshell/pinsquirrel/commit/faf99023d4443e5a123c24299c9a07ed4faa0691))
* send Mailgun requests to the configured region (2.29) ([f33d48d](https://github.com/andrewshell/pinsquirrel/commit/f33d48df90e718308564523a4641da8f89873159))
* stop casting parsed form fields to string in auth.tsx (2.17) ([836683a](https://github.com/andrewshell/pinsquirrel/commit/836683af66a88081d884a38147164f4d294b9439))
* stop nesting sentences inside the id error templates (2.25) ([a483b0f](https://github.com/andrewshell/pinsquirrel/commit/a483b0f4aa206e86f6c8de46f92d8b70d67f2c1c))
* write a pin and its tags in one transaction (1.4, 2.37) ([261744f](https://github.com/andrewshell/pinsquirrel/commit/261744f4b19859453614342d5631b31f172036eb))


### Performance Improvements

* index pins on (user_id, created_at) (2.34) ([75b15a2](https://github.com/andrewshell/pinsquirrel/commit/75b15a22a052de0299402e3e08ca2e87c3d3d203))
* load roles for a whole status batch in one query (2.35) ([f4d9a8e](https://github.com/andrewshell/pinsquirrel/commit/f4d9a8e50fe67a860dd8451348fa2ce79f566af6))
* merge tags in three statements instead of per pin (2.36) ([17d869c](https://github.com/andrewshell/pinsquirrel/commit/17d869c26b4e09f54fb99b4999542b2414e775de))

## [3.4.1](https://github.com/andrewshell/pinsquirrel/compare/v3.4.0...v3.4.1) (2026-08-18)


### Bug Fixes

* repair the production Docker build and startup for pnpm 11 ([d85abda](https://github.com/andrewshell/pinsquirrel/commit/d85abda1606eaced4618e1b2c52ad0ed502826c2))

## [3.4.0](https://github.com/andrewshell/pinsquirrel/compare/v3.3.0...v3.4.0) (2026-08-18)


### Features

* add AuthenticationService.grantAdmin ([57ca94c](https://github.com/andrewshell/pinsquirrel/commit/57ca94c85381cef86fdd5967a75827079122a596))
* add PinService.backdatePin ([31dd6c1](https://github.com/andrewshell/pinsquirrel/commit/31dd6c1c1bf16a424ee718e0b25e090de85ea858))
* move grant-access and grant-admin into the admin app ([a7d8e1c](https://github.com/andrewshell/pinsquirrel/commit/a7d8e1ce03a79676ec43dfb1e648959107ff36fb))


### Bug Fixes

* close three brute-force gaps around password checks ([21f14ca](https://github.com/andrewshell/pinsquirrel/commit/21f14cadad26974084aa5a638a50ffa58fdb55d0))
* guard grantAccess against unverified users and report a missing target as 404 ([20cc140](https://github.com/andrewshell/pinsquirrel/commit/20cc14032a6eca19b584128e30f07ebbb4496e8e))
* make the lint-staged eslint hooks actually run ([7556c19](https://github.com/andrewshell/pinsquirrel/commit/7556c19ef92803425194287de2808d1cb46609e6))
* require AccountService's email dependencies ([51d13df](https://github.com/andrewshell/pinsquirrel/commit/51d13df8b5eb7b053a67ad3eae7085b3a123d176))
* run lint-staged from local node_modules in pre-commit hook ([fd427f8](https://github.com/andrewshell/pinsquirrel/commit/fd427f8b311f12455cc738decc6407a66ea8215a))
* stop the REST API exposing private pins ([1ca149e](https://github.com/andrewshell/pinsquirrel/commit/1ca149eda24c043c26b5248255b08c3c553d0325))

## [3.3.0](https://github.com/andrewshell/pinsquirrel/compare/v3.2.1...v3.3.0) (2026-08-13)


### Features

* add private pins with re-authentication and incognito-style UI ([4facb67](https://github.com/andrewshell/pinsquirrel/commit/4facb677fb4a2c4599f025200e3314b9c79f30b4))
* **admin:** local web app to read and contact the waitlist ([00394cb](https://github.com/andrewshell/pinsquirrel/commit/00394cb7d344769f7fdebcf0006d71a0e5da6b94))
* **api:** add OpenAPI spec and Scalar docs UI ([cafe7a1](https://github.com/andrewshell/pinsquirrel/commit/cafe7a1ace3ba9c0b5ed0ad08d76ae9d8ffa5ce7))
* **api:** add read-only REST API at /api/v1 with API key auth ([40b60c9](https://github.com/andrewshell/pinsquirrel/commit/40b60c96bb64aa8ea8bfbd90b94443ca715e19c2))
* **auth:** add early-access waitlist and user lifecycle states ([b307a70](https://github.com/andrewshell/pinsquirrel/commit/b307a700e5f46788821f6449046cacbbece48fb3))
* **auth:** add grant-admin CLI script ([800bb3f](https://github.com/andrewshell/pinsquirrel/commit/800bb3f23bf187128fb2264258580a1911c8eb0a))
* **crypto:** seal waitlist emails to a public key ([416cbbd](https://github.com/andrewshell/pinsquirrel/commit/416cbbdfa83b19940e2fe50b88e4fcb9a3646ef9))
* **mcp:** add read-only MCP endpoints with API key auth ([087c1c1](https://github.com/andrewshell/pinsquirrel/commit/087c1c160ec984d22e1a005f1ec6506f9c7dac7e))
* **seo:** declare Content-Signal preferences in robots.txt ([2fc181e](https://github.com/andrewshell/pinsquirrel/commit/2fc181ef64c5f906b468bb22e86066c35d5999f2))
* **seo:** negotiate text/markdown on public pages ([e9cc48f](https://github.com/andrewshell/pinsquirrel/commit/e9cc48fba4a60f4940a0cbd04cd0adb42dfa6634))
* **seo:** serve /robots.txt and /sitemap.xml ([24fb872](https://github.com/andrewshell/pinsquirrel/commit/24fb872a00e0893f8133aafe691aa00c368dff3a))


### Bug Fixes

* **deps:** bump axios override to &gt;=1.15.0 and hono to &gt;=4.12.12 ([9103c07](https://github.com/andrewshell/pinsquirrel/commit/9103c07f9a41598b73d89a7d1fd84d954e0aea1d))
* **deps:** bump axios override to &gt;=1.15.2 to clear high-severity advisories ([1f8a70b](https://github.com/andrewshell/pinsquirrel/commit/1f8a70bd4eb67227a309f8a12b3493621a9b5738))
* **deps:** clear all open Dependabot advisories ([#62](https://github.com/andrewshell/pinsquirrel/issues/62)) ([8e999a0](https://github.com/andrewshell/pinsquirrel/commit/8e999a038341301d301491ed98dfbcfec8724ad2))
* **deps:** clear moderate hono, qs, and ip-address advisories ([dde0e33](https://github.com/andrewshell/pinsquirrel/commit/dde0e33d5953fa97e3f208453d69806f2a1e428b))
* **deps:** force esbuild &gt;=0.25 under the deprecated [@esbuild-kit](https://github.com/esbuild-kit) chain ([1d53199](https://github.com/andrewshell/pinsquirrel/commit/1d53199e55a9101b367b9f7b9fb946619194b7d2))
* **deps:** raise axios and fast-uri overrides above high advisories ([5cbf66f](https://github.com/andrewshell/pinsquirrel/commit/5cbf66fee1401392d0e8f27125e5315f00db2e41))
* **deps:** upgrade @hono/node-server to 2.x to fix path traversal ([e50dde1](https://github.com/andrewshell/pinsquirrel/commit/e50dde19fdecaadab6f6b91209231d168d68a8c7))
* **lint:** set tsconfigRootDir and correct VSCode workingDirectories ([8fdc448](https://github.com/andrewshell/pinsquirrel/commit/8fdc44867eb426f53d9f6714d95dfcfc1f458f32))

## [3.2.1](https://github.com/andrewshell/pinsquirrel/compare/v3.2.0...v3.2.1) (2026-04-06)


### Bug Fixes

* **build:** disable DTS generation to fix TypeScript 6 baseUrl deprecation ([365a6e7](https://github.com/andrewshell/pinsquirrel/commit/365a6e727e23f8fddfe2a5ff4e4f276a80a047ea))
* **database:** move drizzle-kit to dependencies for production migrations ([4b597c6](https://github.com/andrewshell/pinsquirrel/commit/4b597c6a3c3a962fb209f56e2b211ce290bc7b16))

## [3.2.0](https://github.com/andrewshell/pinsquirrel/compare/v3.1.0...v3.2.0) (2026-04-06)


### Features

* add brute-force rate limiting on auth endpoints ([14ded1c](https://github.com/andrewshell/pinsquirrel/commit/14ded1c13dfdfaf4f4121fa44f97a406182082c7))


### Bug Fixes

* add CI dependency scanning and surface email-delivery failures ([d5a2bfa](https://github.com/andrewshell/pinsquirrel/commit/d5a2bfa071bd3f27d56e5ded5e9c90e33488b04e))
* add MySQL service container to CI for database tests ([b70a0f6](https://github.com/andrewshell/pinsquirrel/commit/b70a0f65f1242b6924ace8818b054fa171939c75))
* Adding csrf middleware ([bded72d](https://github.com/andrewshell/pinsquirrel/commit/bded72db4124187e917caa906a3a03f26f321c99))
* **api:** return 200 with error payload from metadata endpoint ([f738e02](https://github.com/andrewshell/pinsquirrel/commit/f738e028d8491fa040cbdfa698bcb88539f2b08d))
* Changing colors for WCAG 2.2 AAA accessibility standards ([2477bad](https://github.com/andrewshell/pinsquirrel/commit/2477bada219d1b4f328566793e9ba66ec164b8a3))
* **deps:** align TypeScript to ^6.0.2 in all workspace packages ([4e97ee8](https://github.com/andrewshell/pinsquirrel/commit/4e97ee8119446cdeda90c94e270ca6eba082db92))
* don't output error messages in health endpoint ([db7d0a0](https://github.com/andrewshell/pinsquirrel/commit/db7d0a0db87802d162fd7ecab0022a37bd699dfc))
* Improved design for error messages ([4bceffe](https://github.com/andrewshell/pinsquirrel/commit/4bceffe3730896272aa442cf9e138424798d5c41))
* maintain filters when editing ([8c42459](https://github.com/andrewshell/pinsquirrel/commit/8c4245940037a867d708885fa003760781aefc1b))
* mitigate login timing side-channel for username enumeration ([207f365](https://github.com/andrewshell/pinsquirrel/commit/207f3653672c2dd84f3800f1cb008aa0701416cf))
* prevent username/email enumeration on signup endpoint ([3b9c48f](https://github.com/andrewshell/pinsquirrel/commit/3b9c48facff459bcab481197091db7187d7d2a0c))
* raise minimum password length from 8 to 12 characters ([e3f9a3e](https://github.com/andrewshell/pinsquirrel/commit/e3f9a3e01fc1d8ba64b5960de511ce1181034b4a))
* remove unnecessary non-null assertion in style guide ([04a869e](https://github.com/andrewshell/pinsquirrel/commit/04a869e8af53a2e3010ab64bb369eb4a9bdc7d90))
* replace unstructured console logs with pino structured logger ([d97c329](https://github.com/andrewshell/pinsquirrel/commit/d97c32914a204d91a1638cc7512ba949cd3cd5bb))
* style page and improved brightness for colors ([d2add31](https://github.com/andrewshell/pinsquirrel/commit/d2add315db5d6cde7e93f5fa694d9550af080141))
* upgrade dependencies to resolve high security vulnerabilities ([133e1cb](https://github.com/andrewshell/pinsquirrel/commit/133e1cbccb7486121e101bf7cbe062968a4a9709))
* using theme colors and fixing some contrast issues ([9c752d0](https://github.com/andrewshell/pinsquirrel/commit/9c752d0c58895ec832bd846c1365f4028c472bba))

## [3.1.0](https://github.com/andrewshell/pinsquirrel/compare/v3.0.0...v3.1.0) (2026-03-26)


### Features

* API Key Infrastructure ([#25](https://github.com/andrewshell/pinsquirrel/issues/25)) ([b0d8be1](https://github.com/andrewshell/pinsquirrel/commit/b0d8be1d6fb0068abd43e05c34c70e0a7ac69210))
* Form Validation Errors Without Full Reload ([ff50d68](https://github.com/andrewshell/pinsquirrel/commit/ff50d68fd6f2eb4b8b7f7b1de72b8d793950c1ec))
* Implementing API key UI on profile page ([d740e4e](https://github.com/andrewshell/pinsquirrel/commit/d740e4e96119316b50224a8d18e90231a70a3851))
* Improved /health endpoint ([b1f1b2b](https://github.com/andrewshell/pinsquirrel/commit/b1f1b2b6bb99c53c2571f14c029981fc5538324f))
* Improved duplicate url error to include link to edit ([6423d29](https://github.com/andrewshell/pinsquirrel/commit/6423d2977fcd850a8f38692fea6f8278062b45f6))
* Improved HTMX delete pin flow ([1cc6237](https://github.com/andrewshell/pinsquirrel/commit/1cc62373d8b5f33269481793d806830c81760039))
* Improved search from pin page ([8ae2f8b](https://github.com/andrewshell/pinsquirrel/commit/8ae2f8bec6bdea91445f21d2e1813e21a509c34c))
* Leverage HTMX with the filters for improved experience ([a9997a4](https://github.com/andrewshell/pinsquirrel/commit/a9997a4dddc467875fb5ee088a08591b848565d0))
* Simplify calls to content to use pins instead ([c799463](https://github.com/andrewshell/pinsquirrel/commit/c7994634f1c96adc67334ae4cf3d8901ad8db159))
* Simplify calls to replace content ([87eee6f](https://github.com/andrewshell/pinsquirrel/commit/87eee6f8d58e4b3699aa3992e8ab7481a6a0e216))

## [3.0.0](https://github.com/andrewshell/pinsquirrel/compare/v2.1.0...v3.0.0) (2026-03-10)


### ⚠ BREAKING CHANGES

* Database engine changed from PostgreSQL to MySQL. Requires a MySQL 8 instance and updated DATABASE_URL connection strings.

### Features

* mark database migration as breaking change ([14a3d69](https://github.com/andrewshell/pinsquirrel/commit/14a3d6981aac75f83da7692f34d46f0fafffbac6))
* migrate database from PostgreSQL to MySQL ([5676c05](https://github.com/andrewshell/pinsquirrel/commit/5676c05032890085b24c7bb7c6d6b5b268ecd7a1))

## [2.1.0](https://github.com/andrewshell/pinsquirrel/compare/v2.0.3...v2.1.0) (2026-03-10)


### Features

* add pin export in Pinboard JSON format ([2c2f2d0](https://github.com/andrewshell/pinsquirrel/commit/2c2f2d09c6283624f7bf419a640da65c4ebd0e39))

## [2.0.3](https://github.com/andrewshell/pinsquirrel/compare/v2.0.2...v2.0.3) (2026-02-01)


### Bug Fixes

* add --no-cache to Docker buildx to prevent stale builds ([df26c4e](https://github.com/andrewshell/pinsquirrel/commit/df26c4e7dc920fb9f092374463331b07c180e3c0))

## [2.0.2](https://github.com/andrewshell/pinsquirrel/compare/v2.0.1...v2.0.2) (2026-02-01)


### Bug Fixes

* add CJS dependencies for Docker production runtime ([79f27df](https://github.com/andrewshell/pinsquirrel/commit/79f27dfc8f91c3a9afd5bcf47d3731bc12b1d563))
* mark CJS packages as external in tsup to prevent dynamic require error ([8fa3fd2](https://github.com/andrewshell/pinsquirrel/commit/8fa3fd2d9cb53d98eec54d890e89735e577f0b68))

## [2.0.1](https://github.com/andrewshell/pinsquirrel/compare/v2.0.0...v2.0.1) (2026-02-01)


### Bug Fixes

* bundle workspace dependencies for Docker production build ([22821d0](https://github.com/andrewshell/pinsquirrel/commit/22821d0f1ee9fb5b915f6daaa3d17659db9a2b91))

## [2.0.0](https://github.com/andrewshell/pinsquirrel/compare/v1.1.5...v2.0.0) (2026-02-01)


### ⚠ BREAKING CHANGES

* The React Router 7 app has been removed. PinSquirrel now uses Hono + HTMX exclusively.

### Features

* add AccessGateable support for User entities with union types ([a283143](https://github.com/andrewshell/pinsquirrel/commit/a283143347eb72a927377d96eed23a4d03f5d1f5))
* add Agent OS spec for tag management UI ([8da9fbb](https://github.com/andrewshell/pinsquirrel/commit/8da9fbb1fc3eb97c247d6013f7c83bd3043a8fd1))
* Add code coverage configuration for Vitest ([3973f85](https://github.com/andrewshell/pinsquirrel/commit/3973f85f508e5fd3aa0d9ff77f75ea7faa52408f))
* Add comprehensive accessibility and polish improvements ([c282658](https://github.com/andrewshell/pinsquirrel/commit/c2826582887a1fa41d5c49c646394849ab87cf8c))
* Add comprehensive accessibility and polish improvements ([c1d1fd4](https://github.com/andrewshell/pinsquirrel/commit/c1d1fd4214607a48a635789edaebca3cc8c30a88))
* Add comprehensive Docker support and development documentation ([efb76f2](https://github.com/andrewshell/pinsquirrel/commit/efb76f209c57fa4b8c48e00d4d2717c7a8f4a700))
* Add comprehensive pin seeding script for manual testing ([73761c7](https://github.com/andrewshell/pinsquirrel/commit/73761c755db7d1b4c914802c4d5fb5fb839dbdc8))
* Add comprehensive pin seeding script for manual testing ([c74d417](https://github.com/andrewshell/pinsquirrel/commit/c74d417dddcca224783c429b46c64b9ad41fa0e5))
* add comprehensive test coverage improvements ([15db7a9](https://github.com/andrewshell/pinsquirrel/commit/15db7a91fe42ea3fa12d252c17f0d5cb3f0985bf))
* Add core and database packages, remove API app ([a06694e](https://github.com/andrewshell/pinsquirrel/commit/a06694eff450f1160736841db34f91d50b5c260a))
* add Docker deployment scripts and improve build configuration ([6823861](https://github.com/andrewshell/pinsquirrel/commit/682386164d1001e824c52831ab155773a7a39d06))
* add duplicate URL detection and created date display ([41cd4b2](https://github.com/andrewshell/pinsquirrel/commit/41cd4b262b96aa48b1bf54a274fddfaad54a3ae3))
* add edit mode support to PinCreationForm component ([3c5eed7](https://github.com/andrewshell/pinsquirrel/commit/3c5eed7ac86bf0441e0a18a7c41ff4389f4eeefb))
* add edit navigation links to PinCard component ([00df77c](https://github.com/andrewshell/pinsquirrel/commit/00df77c32d1b5bb037db03ffb9d2b000646565ab))
* add loading state to import button ([34e2b87](https://github.com/andrewshell/pinsquirrel/commit/34e2b877f7be60a2871573d49d8fa5c0b71db74f))
* add metadata refresh button to pin forms ([702d340](https://github.com/andrewshell/pinsquirrel/commit/702d34025283b87ce09aa0c7d0a8cdd36e305bce))
* add neobrutalism-styled tag filter header ([834bef7](https://github.com/andrewshell/pinsquirrel/commit/834bef75946866f27d28f716609739fb5b3323f0))
* Add pagination controls to pin list view ([7d56362](https://github.com/andrewshell/pinsquirrel/commit/7d56362af40492fb207789a65cf6cc9b3b1d83a8))
* Add pagination controls to pin list view ([33329ce](https://github.com/andrewshell/pinsquirrel/commit/33329ce2c75900df695bc344eabf57331f77ab32))
* add pin deletion with confirmation spec ([92b5f0f](https://github.com/andrewshell/pinsquirrel/commit/92b5f0f7edfacc51707ef171d22dcc155a5a14fb))
* add Pinboard import functionality with duplicate prevention and timestamp preservation ([1eba169](https://github.com/andrewshell/pinsquirrel/commit/1eba1693ec587dc0fbd15e41c68e53a407d44f42))
* add pinboard import script with timestamp preservation ([f4bef2f](https://github.com/andrewshell/pinsquirrel/commit/f4bef2f136d74ab4b62a6bac5ab8021ad540694f))
* add pinboard import script with timestamp preservation ([b013395](https://github.com/andrewshell/pinsquirrel/commit/b013395437fb76317e61301920c002e0f0a35fb4))
* Add production-ready Hono API with TypeScript and Vite integration ([55f14ca](https://github.com/andrewshell/pinsquirrel/commit/55f14cadd4b5200409f0f1f66c116e6b9903b9a6))
* add signup notification email with NOTIFY_EMAIL env var ([8743736](https://github.com/andrewshell/pinsquirrel/commit/87437368ef10d20378c1ae0dcf3b32f0b4cc79cd))
* Add structured logging with simple logger utility ([8279fc2](https://github.com/andrewshell/pinsquirrel/commit/8279fc28f93d3ee1cd1fdf8aff930f3d8059fb49))
* add tag merge functionality and auto-cleanup empty tags ([bb5cbe1](https://github.com/andrewshell/pinsquirrel/commit/bb5cbe1507144a9c049067cfd16dfab1fed3c6f5))
* add TagWithCount interface and repository method ([0cb6675](https://github.com/andrewshell/pinsquirrel/commit/0cb6675450a806601b29bce9294eac3a887ac6a8))
* Add typecheck command and align dependencies across monorepo ([d0c3e35](https://github.com/andrewshell/pinsquirrel/commit/d0c3e3552c168bf4d8cec7c6a00a0cf76780301c))
* add untagged pins filtering with tags page integration ([d0e2663](https://github.com/andrewshell/pinsquirrel/commit/d0e2663bcd9b9b30574e144313138a828426fc1e))
* add view settings and case-insensitive title sorting ([4294a82](https://github.com/andrewshell/pinsquirrel/commit/4294a826fb362d854f53a80c89f3ea053747ab55))
* Add VS Code workspace configuration for consistent development ([8f36d16](https://github.com/andrewshell/pinsquirrel/commit/8f36d1664d6d201deda54ce22c52b46fafcc150a))
* Build pin list display with loader integration ([b78cfd2](https://github.com/andrewshell/pinsquirrel/commit/b78cfd22d9782846c6431e99939f49a3694cea34))
* Build pin list display with loader integration ([747177e](https://github.com/andrewshell/pinsquirrel/commit/747177e093df881c4fc7c5424ebf7c1b584a7ade))
* complete AccessControl implementation and clean up domain entities ([2598fe3](https://github.com/andrewshell/pinsquirrel/commit/2598fe3aae09e7ee3e1e89ab99868e9114b3a5e6))
* complete neobrutalism design transformation ([b1b75f6](https://github.com/andrewshell/pinsquirrel/commit/b1b75f638c9ba701162267ccb08766e84484c99b))
* complete pin creation form UI interactions (task 4) ([bfffe75](https://github.com/andrewshell/pinsquirrel/commit/bfffe75b1654e9cf26b0574385b53de292ec5b99))
* complete pin creation form UI interactions (task 4) ([97e5e37](https://github.com/andrewshell/pinsquirrel/commit/97e5e379f423c0479559e832ebfa88889ca9b66b))
* complete pin deletion confirmation integration testing ([00c3bbd](https://github.com/andrewshell/pinsquirrel/commit/00c3bbd36096dc1460f7c903b6fa65def5d999f7))
* convert pin CRUD operations to modal dialog routes ([522a0b0](https://github.com/andrewshell/pinsquirrel/commit/522a0b0f368853aa56e8d049a5a9b29d22affc18))
* create DismissibleAlert component and complete pin editing tasks ([6868488](https://github.com/andrewshell/pinsquirrel/commit/6868488a6728911ccd3cbbd444f16d81c31bf001))
* **database:** add sessions table for Hono auth ([809e8b0](https://github.com/andrewshell/pinsquirrel/commit/809e8b0c0a10a590be0a57972a089bab4f371e5e))
* eliminate test output noise for clean test reporting ([fb16873](https://github.com/andrewshell/pinsquirrel/commit/fb168739e3112578863741822ef4c4b6d0bfff6e))
* enforce comprehensive quality checks before task completion ([43c6bb8](https://github.com/andrewshell/pinsquirrel/commit/43c6bb82c9dd64682163961d822d219c97e1f1e4))
* enhance metadata fetching with auto-populated description ([580fb9f](https://github.com/andrewshell/pinsquirrel/commit/580fb9ff7d4e269ff5b722cf3f47e394f52ddc6c))
* enhance mobile user experience with responsive design improvements ([74d18ef](https://github.com/andrewshell/pinsquirrel/commit/74d18ef501e5db7cabfc5dd26f2aa917b5bbdfaf))
* enhance PinCreationForm accessibility (task 5) ([a9cb925](https://github.com/andrewshell/pinsquirrel/commit/a9cb925edd4faaabefed54cc24552057d3b0d689))
* enhance UI consistency and branding across authentication and homepage ([d3863d9](https://github.com/andrewshell/pinsquirrel/commit/d3863d97d086de287a1a3039be9d60690bb053eb))
* finalize header improvements and update roadmap ([6f6e752](https://github.com/andrewshell/pinsquirrel/commit/6f6e752f501de1c1d078a469261ee40e8924e7b9))
* hide Pins and Tags navigation links when search is open ([983403e](https://github.com/andrewshell/pinsquirrel/commit/983403ea7ce079e1c6b9d13a4f8179dccb12e8bc))
* **hono:** add 404 and 500 error pages ([a98a643](https://github.com/andrewshell/pinsquirrel/commit/a98a643a047aec5b6b95ba86aa6e2469da7b23e5))
* **hono:** add Alert component for inline notifications ([cad572b](https://github.com/andrewshell/pinsquirrel/commit/cad572bd14b55af77f1e41ef0780ecc408848c1d))
* **hono:** add Alpine.js tag input with autocomplete ([c5d446c](https://github.com/andrewshell/pinsquirrel/commit/c5d446c3b7a0404281d0ee766e5c488c5f44ce6a))
* **hono:** add concurrent CSS watch to dev script ([3e18fbc](https://github.com/andrewshell/pinsquirrel/commit/3e18fbc8d6ed92b35cbd56465dc5f15e2e3e3bf9))
* **hono:** add dark mode support and consolidate flash messages ([052d59c](https://github.com/andrewshell/pinsquirrel/commit/052d59ccfe419fe8bae4431559b5f505a670502d))
* **hono:** add database-backed session middleware ([6b17a4e](https://github.com/andrewshell/pinsquirrel/commit/6b17a4ecec9047f397d613f639ae5a341b8022ac))
* **hono:** add Docker configuration for production deployment ([130c03c](https://github.com/andrewshell/pinsquirrel/commit/130c03c862979bdeeb7e290c409237c3dccf8cfb))
* **hono:** add forgot password and reset password flows ([32462dd](https://github.com/andrewshell/pinsquirrel/commit/32462dd64b15e89c0b6deadaa6fa3def7349ac3a))
* **hono:** add form UI components and refactor pin pages ([b37d3d6](https://github.com/andrewshell/pinsquirrel/commit/b37d3d6d894ff1b36f01c451af5bc265f2752044))
* **hono:** add HTMX-powered pin list partial for dynamic updates ([1fec0f9](https://github.com/andrewshell/pinsquirrel/commit/1fec0f98f8262ca1e49f5421209932cacae51566))
* **hono:** add metadata API endpoint for URL title/description fetch ([b006657](https://github.com/andrewshell/pinsquirrel/commit/b006657cba269bca82016b99a1301d2e7c2e63af))
* **hono:** add missing pages for full feature parity ([f0f502a](https://github.com/andrewshell/pinsquirrel/commit/f0f502a9720ecbb72ca35ee7fdf865fc3fc8f21e))
* **hono:** add pin creation form and route handlers ([3e8a51c](https://github.com/andrewshell/pinsquirrel/commit/3e8a51c794d5043e0b7d5a5584a08818085c52e5))
* **hono:** add pin delete confirmation page and routes ([eca63ce](https://github.com/andrewshell/pinsquirrel/commit/eca63ce0ec0e695ad7213165eb02e08383d2c1cb))
* **hono:** add pin edit form and route handlers ([12a1790](https://github.com/andrewshell/pinsquirrel/commit/12a17907cd7bac181495a809488603253237bdea))
* **hono:** add pin list page with filtering and pagination ([33cb032](https://github.com/andrewshell/pinsquirrel/commit/33cb0323a86c54f5870d9e9b6315d7dbeec5c380))
* **hono:** add profile page with account settings ([5bdc8d8](https://github.com/andrewshell/pinsquirrel/commit/5bdc8d8c6f8fbea75637bb63287ae45a6dde2d0d))
* **hono:** add reusable Card component with responsive borders ([108d5ff](https://github.com/andrewshell/pinsquirrel/commit/108d5ff02701470c2c311e4a0c3810bc6bc1077b))
* **hono:** add search box and import link to mobile menu ([4d64f13](https://github.com/andrewshell/pinsquirrel/commit/4d64f13637d4af2d9648ca3eb623f1ac8dd62c19))
* **hono:** add sign-in, sign-up, and logout routes ([6445495](https://github.com/andrewshell/pinsquirrel/commit/64454951742d01da498234c52680a141a08f93ea))
* **hono:** add tag merge page ([9681d3f](https://github.com/andrewshell/pinsquirrel/commit/9681d3fadf51d6393205f18ed337fb7501820cc6))
* **hono:** add tags cloud page with filtering ([4eba4d7](https://github.com/andrewshell/pinsquirrel/commit/4eba4d79ac0b0055c6db0dca50f7f1e7b9e02d38))
* **hono:** add toggle-read endpoint for HTMX pin updates ([962aa5a](https://github.com/andrewshell/pinsquirrel/commit/962aa5adb8dd34d8240f47c0d87c1906fa1565b6))
* **hono:** add URL metadata auto-fetch to pin forms ([64045ae](https://github.com/andrewshell/pinsquirrel/commit/64045ae0bce70c86c1b38f44936d6bdc57bd8c89))
* **hono:** add view settings for sort, direction, and size ([8d5cfec](https://github.com/andrewshell/pinsquirrel/commit/8d5cfece4a1e87a2749bc4f906f4b112cc600253))
* **hono:** match React UI for header, filters, and view settings ([965a1cc](https://github.com/andrewshell/pinsquirrel/commit/965a1cc07d3e8d30bbfd3090737263b3c20dd4b0))
* **hono:** migrate homepage from React to Hono ([dedbb5f](https://github.com/andrewshell/pinsquirrel/commit/dedbb5fe07dd84ed88f0cbba1634aa877b819dc4))
* **hono:** upgrade tag merge page with custom dropdown components ([6fc32f2](https://github.com/andrewshell/pinsquirrel/commit/6fc32f27a38cdaa0bb094a480eb1f06eb683fd13))
* husky + lint-staged setup for monorepo ([d5d12a8](https://github.com/andrewshell/pinsquirrel/commit/d5d12a8cd5958527bbeeafe9529160885a58c6b7))
* implement "Keep me signed in" functionality with rolling session extension ([449b9a0](https://github.com/andrewshell/pinsquirrel/commit/449b9a0cd3f415981ae6a2bea8d04da98e663513))
* implement complete password reset flow ([99ca863](https://github.com/andrewshell/pinsquirrel/commit/99ca86321bf1b2b574855a23ee2157713f6102f1))
* Implement comprehensive authentication system with real database testing ([c7fe8f3](https://github.com/andrewshell/pinsquirrel/commit/c7fe8f35d8dbad3ebe7c583d9c82435fc422dc66))
* implement comprehensive filter parameter preservation ([8e3754d](https://github.com/andrewshell/pinsquirrel/commit/8e3754ddd2ed6f8a8320f34d5eeabaa42eafb276))
* implement comprehensive lowercase enforcement for all tags ([adacaa9](https://github.com/andrewshell/pinsquirrel/commit/adacaa9ea7b0df9d189055f19f5a1e6bf50dd4f0))
* Implement comprehensive pin and tag management system ([e1c86e9](https://github.com/andrewshell/pinsquirrel/commit/e1c86e946176ab50df3c7d21394037dc5be0c864))
* Implement comprehensive pin and tag management system ([5a5b4b8](https://github.com/andrewshell/pinsquirrel/commit/5a5b4b80f362e13dc20ffd1c3cd13fea1ff3a9c4))
* implement comprehensive search functionality ([204f66c](https://github.com/andrewshell/pinsquirrel/commit/204f66c9838fec870637d5ab431177cba54ad39e))
* Implement comprehensive validation system with Zod schemas ([c5fa087](https://github.com/andrewshell/pinsquirrel/commit/c5fa0870e4ae645bf7c25753438833ec5e80ec07))
* Implement data loading with pagination for pin list ([80ce097](https://github.com/andrewshell/pinsquirrel/commit/80ce09781d6b9ebbb74466f68fd2a65f50b88337))
* Implement data loading with pagination for pin list ([a7c392e](https://github.com/andrewshell/pinsquirrel/commit/a7c392e77b0d76f842f9532457feaa7520fdb58c))
* implement email verification for user registration ([15dbdf5](https://github.com/andrewshell/pinsquirrel/commit/15dbdf591f3c670fe404223145d2a4bd0300e37c))
* implement metadata fetching for pin creation ([a41a689](https://github.com/andrewshell/pinsquirrel/commit/a41a689aa3584b6f1067181dd939c42e92847322))
* implement metadata fetching for pin creation ([f559d87](https://github.com/andrewshell/pinsquirrel/commit/f559d87bae3df289bb1a0b9d47fe2e4990c3678c))
* implement mobile-optimized UI with responsive filters and dialogs ([1b4f716](https://github.com/andrewshell/pinsquirrel/commit/1b4f716bdd8e64b9af8dae428637a4f346d58cf7))
* implement password reset functionality with email service ([46b356a](https://github.com/andrewshell/pinsquirrel/commit/46b356a64affe574b9384b9b4e72704996cc89c0))
* Implement pin and tag repository interfaces in database package ([e59f857](https://github.com/andrewshell/pinsquirrel/commit/e59f8579696614af7493780bd0cd137082f2af62))
* Implement pin and tag repository interfaces in database package ([09b9ab9](https://github.com/andrewshell/pinsquirrel/commit/09b9ab91a72d3b3902c9c1ac0fdc3fca25c20e87))
* implement pin creation form with validation ([ae7629e](https://github.com/andrewshell/pinsquirrel/commit/ae7629e47e3bbb8b87c4e579e23d0482375f227c))
* implement pin creation form with validation ([dbfc92e](https://github.com/andrewshell/pinsquirrel/commit/dbfc92e3ee773af8719acd49b087de7c94248e6d))
* implement pin deletion with confirmation dialog ([77860ae](https://github.com/andrewshell/pinsquirrel/commit/77860ae9d003b5132cab21f64abdeb7257cbd562))
* implement pin deletion with confirmation workflow ([201d1ba](https://github.com/andrewshell/pinsquirrel/commit/201d1bab92d0d241affd610f38078d4a0e9d8eb3))
* implement pin edit route and loader (task 1) ([2849a6b](https://github.com/andrewshell/pinsquirrel/commit/2849a6bc208625f0d4a555c998fd4d33da438aca))
* Implement pin list improvements and clickable links ([38ebf33](https://github.com/andrewshell/pinsquirrel/commit/38ebf332d9dade7959483d3068b4f4c33e6560ac))
* Implement pin list improvements and clickable links ([54bc32a](https://github.com/andrewshell/pinsquirrel/commit/54bc32a3c8d7d8a1fcdc7b0fc9e07ca6f38f08d6))
* implement production database migration strategy with SSL support ([35ef846](https://github.com/andrewshell/pinsquirrel/commit/35ef846510aeb4fe911a17fa14ecb1358a493afc))
* implement read later filtering system ([5fb481a](https://github.com/andrewshell/pinsquirrel/commit/5fb481a30f99f269fc0ab7fd0c9841501fa78c5e))
* implement read later functionality with mark as read action ([01a833e](https://github.com/andrewshell/pinsquirrel/commit/01a833eb102863319cc3f8b7037a2a680dad702f))
* implement role-based access control system ([efa2289](https://github.com/andrewshell/pinsquirrel/commit/efa2289f0caddfe57f68271725af5451b83d9deb))
* implement role-based access control system ([28704ba](https://github.com/andrewshell/pinsquirrel/commit/28704bad76678e39b430f2fa8998c549e26ee3a6))
* Implement secure session-based authentication system ([812fd6a](https://github.com/andrewshell/pinsquirrel/commit/812fd6a6e7d1160d539d3cbef17abd31946ee0ad))
* implement tag filtering and tag cloud page ([58dd76e](https://github.com/andrewshell/pinsquirrel/commit/58dd76ee2ac86afe15f3dbc818128a1d0c21d2b6))
* implement tag management UI with TagInput component ([28d8c03](https://github.com/andrewshell/pinsquirrel/commit/28d8c035785bdd1aac702fd2e2747f83624ef898))
* implement Task 2 - pin creation route and action ([e26a97b](https://github.com/andrewshell/pinsquirrel/commit/e26a97b41b812bcab4c0edfbfc37bdffcebdafe1))
* implement Task 2 - pin creation route and action ([da77d63](https://github.com/andrewshell/pinsquirrel/commit/da77d63479c664e1f5b1a8667259308a9f97fe44))
* implement Unicode-aware tag validation with URL safety ([3aecdbc](https://github.com/andrewshell/pinsquirrel/commit/3aecdbcc0738fe0174377298248f8a01ea87ef27))
* implement username-based routing for pins ([5906fe2](https://github.com/andrewshell/pinsquirrel/commit/5906fe23fe2c762b5a2faa7b87af02ab73c66e96))
* implement Web Share Target API integration ([816fa78](https://github.com/andrewshell/pinsquirrel/commit/816fa78a6835e4b53bdf8e9b6d48bfd7be89c392))
* improve header navigation with user menu and simplified labels ([68f689e](https://github.com/andrewshell/pinsquirrel/commit/68f689e490933142473857bcc4018e99b6c03eef))
* improve password change validation UX and extract profile form components ([a36f0b7](https://github.com/andrewshell/pinsquirrel/commit/a36f0b783daeb4b7cf971ca4cab15302b3b70da2))
* Install Agent OS product documentation ([1059746](https://github.com/andrewshell/pinsquirrel/commit/1059746efd1b0d2703842bf0db0910af35d15dbe))
* integrate edit mode in pins.$id.edit route component ([5b832d9](https://github.com/andrewshell/pinsquirrel/commit/5b832d970e89221586f577a800b1b6f692a974f8))
* Integrate shadcn/ui component system with Tailwind CSS v4 ([8bf0426](https://github.com/andrewshell/pinsquirrel/commit/8bf0426a751bbfeee7ecf06334b59476c3ca2986))
* mark pin list view as complete and add pin creation form spec ([37af70a](https://github.com/andrewshell/pinsquirrel/commit/37af70a9b76f668c10796e692af48759b4b239a4))
* merge PinFilter into FilterHeader for unified filtering UI ([0d2ae46](https://github.com/andrewshell/pinsquirrel/commit/0d2ae461bc68ed387e93a1003c1e782a7c93e353))
* preserve original timestamps in Pinboard import ([c83d695](https://github.com/andrewshell/pinsquirrel/commit/c83d6956b7e971e7bd123727ab51d22ab236b347))
* scaffold Hono app for stack migration ([5047804](https://github.com/andrewshell/pinsquirrel/commit/5047804af7e121614484fbc765a81d9083cd2c1c))
* Set up basic pin list route and components ([135d2ca](https://github.com/andrewshell/pinsquirrel/commit/135d2ca53799233173d34d60b85eb8302a4c549b))
* Set up basic pin list route and components ([249258d](https://github.com/andrewshell/pinsquirrel/commit/249258d66fa4f611fcb0054cdeb039ff1644b12f))
* Setup React Router 7 app with complete development environment ([15dad73](https://github.com/andrewshell/pinsquirrel/commit/15dad73a3ca615088358c079151214ae24d5723b))
* significantly improve test coverage to 75.95% ([3bac19c](https://github.com/andrewshell/pinsquirrel/commit/3bac19c8f7b97bd9e5ce39c603e6f51c45284a20))
* standardize authentication routes and labels ([6171d69](https://github.com/andrewshell/pinsquirrel/commit/6171d691b2b9358299e73d2bd427110deaeedf6a))
* UI improvements and text standardization ([d76770a](https://github.com/andrewshell/pinsquirrel/commit/d76770a6daeb9c735aeb4533a9f93d03be5fcf00))
* update dialog animations to slide from bottom and enable host access ([10198b8](https://github.com/andrewshell/pinsquirrel/commit/10198b8483d41602c3cc4699d27e32d5b1db6f7f))


### Bug Fixes

* add POST method support for Web Share Target API ([0b1195e](https://github.com/andrewshell/pinsquirrel/commit/0b1195ef143437aff5dc26c81e3f08cd7a73f563))
* add type guards for FormData string values ([0192e96](https://github.com/andrewshell/pinsquirrel/commit/0192e9687ca432d2933e8860ea1687cf24ab590e))
* complete removal of image_path and content_path references ([2e52e7c](https://github.com/andrewshell/pinsquirrel/commit/2e52e7c484814295085f06712520f31d8b3edabc))
* **hono:** add DOCTYPE declaration and favicon links ([39ed04c](https://github.com/andrewshell/pinsquirrel/commit/39ed04c419dbe277479f8c3da0a71edf4f2384c8))
* **hono:** add header to auth pages ([4fd1615](https://github.com/andrewshell/pinsquirrel/commit/4fd1615d8b9b6c767694577a37c76c9f40a98163))
* **hono:** add header to terms and privacy pages ([1e49e75](https://github.com/andrewshell/pinsquirrel/commit/1e49e7540945de5100aaebd63a8156023ec245f7))
* **hono:** add neobrutalism styling to mobile Create Pin button ([723746b](https://github.com/andrewshell/pinsquirrel/commit/723746b27f150abb45c865a47aafd1f840ae6fd3))
* **hono:** add x-cloak to prevent dropdown flash on page load ([be6dc38](https://github.com/andrewshell/pinsquirrel/commit/be6dc383db5bdfda52b5e60ac1423993749f577a))
* **hono:** align Header with React app behavior ([d54dcfd](https://github.com/andrewshell/pinsquirrel/commit/d54dcfd15e74c2b4308c70a72ed45d3eac28c894))
* **hono:** display Untagged filter pill on pins page ([38ddaba](https://github.com/andrewshell/pinsquirrel/commit/38ddaba65a0ef3698ed95c466706009de49bd6d3))
* **hono:** fix CSS styling and database connection ([bc78653](https://github.com/andrewshell/pinsquirrel/commit/bc7865344cbccd759d1e801cf49fe9ac67d699b3))
* **hono:** fix filter UI and add search input to header ([10808e6](https://github.com/andrewshell/pinsquirrel/commit/10808e6b0dd9a5154a6af4f094dfc8b011742d08))
* **hono:** Header and layout improvements ([ff3134f](https://github.com/andrewshell/pinsquirrel/commit/ff3134f931e4acb5de7d397fe8e95155ab9a8913))
* **hono:** use Alpine 3.x click.outside instead of click.away ([2039a0f](https://github.com/andrewshell/pinsquirrel/commit/2039a0f8ec182dc6c338200bec82586189ad6e18))
* **hono:** use Button component for mobile Sign Out ([0e46e1a](https://github.com/andrewshell/pinsquirrel/commit/0e46e1a4f0ae9c7f0fa0c91302c219842da0f46a))
* **hono:** use primary color for checkbox accent ([ded0a07](https://github.com/andrewshell/pinsquirrel/commit/ded0a0774eaa8be5f8fd9a403643b9d619a2b00e))
* **hono:** use purple secondary color for tag pills ([35ce7d8](https://github.com/andrewshell/pinsquirrel/commit/35ce7d8c2627409b9d24b0a2630fa8057b45dc5e))
* improve metadata fetching behavior in pin forms ([76b589c](https://github.com/andrewshell/pinsquirrel/commit/76b589c9df4107ca7252bb09e76fdd79cf451c12))
* improve Pinboard import title handling ([0da5771](https://github.com/andrewshell/pinsquirrel/commit/0da5771bb2b3919e5413bf7b617675bb377f2a9e))
* improve search icon UX when search input is visible ([5e01366](https://github.com/andrewshell/pinsquirrel/commit/5e013667c33c3e9604abee5d1b36ed3629c9d896))
* make mobile search input take full width of menu ([c75a030](https://github.com/andrewshell/pinsquirrel/commit/c75a03052a2d608f46779f7fd018bd3345f47b85))
* mobile sign out and PWA manifest improvements ([40a9f15](https://github.com/andrewshell/pinsquirrel/commit/40a9f15cd5158d2b9172e2e25d7fdd0462b2e352))
* preserve bookmarklet URL after authentication ([f76c52f](https://github.com/andrewshell/pinsquirrel/commit/f76c52fbff1e5ba5bb1bd01c9e42372390cdc0b7))
* preserve filter parameters when using pagination ([f343793](https://github.com/andrewshell/pinsquirrel/commit/f3437932dd5d90b49d2657ec298b73f062e8266a))
* preserve filter params when navigating to Create Pin form ([ee04d37](https://github.com/andrewshell/pinsquirrel/commit/ee04d3796eac76aadc203c54dddc2a0571747817))
* prevent login for users without User role ([4e8774b](https://github.com/andrewshell/pinsquirrel/commit/4e8774b7cf2f6dd3455833604442e0036c251899))
* prevent mobile zoom by updating font sizes to 16px minimum ([697d4bc](https://github.com/andrewshell/pinsquirrel/commit/697d4bca45b64d3e0efdb81231d458932bc95e94))
* remove username-based routes and add password reset debugging ([bffa05a](https://github.com/andrewshell/pinsquirrel/commit/bffa05abf50195a2db6abf06ffc3da7e711e2d40))
* resolve bookmarklet domain redirection issue ([c17ca48](https://github.com/andrewshell/pinsquirrel/commit/c17ca485af1ca8844c15219ae4a49ee9818b97f6))
* resolve pin edit form issues with tags and read later checkbox ([14fb3c6](https://github.com/andrewshell/pinsquirrel/commit/14fb3c6acd6c2e106d1b5a5d0666e32852378feb))
* resolve React Router error handling in tests and update route structure ([fc55387](https://github.com/andrewshell/pinsquirrel/commit/fc5538730d9acc466bae0d5797d01bc507516d63))
* resolve readLater checkbox not saving unchecked state ([9ace49d](https://github.com/andrewshell/pinsquirrel/commit/9ace49dca6484aeff3dfb9359a57f5956512b263))
* resolve Safari tag selection issue in TagInput component ([a8597fe](https://github.com/andrewshell/pinsquirrel/commit/a8597feaea2fb91b41acd4120d0a1624adf84644))
* resolve tag handling issues in pin creation and editing ([e35a569](https://github.com/andrewshell/pinsquirrel/commit/e35a5698780442cc95e797676c53d803f2b40bcb))
* resolve tagNames validation error in pin editing and complete tag management UI ([aab1b03](https://github.com/andrewshell/pinsquirrel/commit/aab1b03aba3b15ef1bfe04bf02afcf249b04031f))
* simplify SSL configuration in Drizzle ([077412e](https://github.com/andrewshell/pinsquirrel/commit/077412e653426aee0e0428a51833bbeedac57664))
* skip postinstall scripts in Docker production build ([1a2fa2e](https://github.com/andrewshell/pinsquirrel/commit/1a2fa2eef215b2a67c46be555b436656b4d42ec2))
* treat empty email strings as optional in signup form ([c2fcd68](https://github.com/andrewshell/pinsquirrel/commit/c2fcd68f8d57c105a4371139cb0f65d039d6f666))
* truncate long descriptions in Pinboard import ([9759f4c](https://github.com/andrewshell/pinsquirrel/commit/9759f4c078845b1012fb6e2043b32f802d4fc934))
* update bookmarklet to use /pins/new instead of /:username/pins/new ([ced04b4](https://github.com/andrewshell/pinsquirrel/commit/ced04b4c5aa448bc6e42d8f3c6219ef7c48a71ae))
* update Dockerfile to reference correct workspace packages ([a3a25d6](https://github.com/andrewshell/pinsquirrel/commit/a3a25d6c08d921dd26309774c4442d2ca66d580c))
* update TagCloud font sizing logic and fix tests ([dbc7856](https://github.com/andrewshell/pinsquirrel/commit/dbc78565ab15187f339181e4a4dbf5cb971bac9c))
* use keepSignedIn checkbox value from login form ([98a9333](https://github.com/andrewshell/pinsquirrel/commit/98a93339a4993a94009a91d757c1cbe1ace32295))


### Performance Improvements

* optimize Pinboard import performance ([2d4d6fd](https://github.com/andrewshell/pinsquirrel/commit/2d4d6fd8085a142b799f6b49489754c449b817a3))


### Miscellaneous Chores

* remove React app and complete Hono migration ([ee12c1d](https://github.com/andrewshell/pinsquirrel/commit/ee12c1da0ecf112e821722b5bf365c98320fd6e4))
