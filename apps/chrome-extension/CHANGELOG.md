# Changelog

## [1.2.2](https://github.com/andrewshell/pinsquirrel/compare/chrome-extension-v1.2.1...chrome-extension-v1.2.2) (2026-11-18)


### Bug Fixes

* **chrome-extension:** disconnect under the refresh lock ([392feb3](https://github.com/andrewshell/pinsquirrel/commit/392feb3ce00ba00156e0363890a1758bed84f035))
* **chrome-extension:** give up on a server request after 20 seconds ([a776ed3](https://github.com/andrewshell/pinsquirrel/commit/a776ed3a3d0a6fe19b138534169335d43776f129))
* **chrome-extension:** keep the worker alive while Disconnect waits ([b933e99](https://github.com/andrewshell/pinsquirrel/commit/b933e99ecf3e86b1d32edb4556df1720e1d37b3b))
* **chrome-extension:** offer Disconnect while asking to reconnect ([c1c8a8d](https://github.com/andrewshell/pinsquirrel/commit/c1c8a8d0b4bfe0f46d61fd1a766404431a966cc2))
* **chrome-extension:** refresh tokens one context at a time and show connect errors ([da22a57](https://github.com/andrewshell/pinsquirrel/commit/da22a570851f5209bf9f90b24d5b28b6ecb51c1c))
* **chrome-extension:** refresh under a lock the options page and worker share ([16c78bb](https://github.com/andrewshell/pinsquirrel/commit/16c78bb16727a1be3f2d4d856cd1dd4d991d8fc1))
* **chrome-extension:** run Disconnect in the service worker ([318516b](https://github.com/andrewshell/pinsquirrel/commit/318516bdc75848960442980a0224ceef110305ab))
* **chrome-extension:** run one options page action at a time ([b8aad3b](https://github.com/andrewshell/pinsquirrel/commit/b8aad3b528545112e25eced66df09f1be3143e95))
* **chrome-extension:** show settings without the reconnect notice after a disconnect ([bf642cd](https://github.com/andrewshell/pinsquirrel/commit/bf642cdd2e186f22d017de2d7da0fd5687052f71))
* **chrome-extension:** show the reconnect view when the worker loses the grant ([b2265f6](https://github.com/andrewshell/pinsquirrel/commit/b2265f651770bb50e29120b50d7120b92da946aa))
* **chrome-extension:** update every open options page when the connection changes ([34d8dda](https://github.com/andrewshell/pinsquirrel/commit/34d8dda21cc72c9a68e465089e41d8379f002259))

## [1.2.1](https://github.com/andrewshell/pinsquirrel/compare/chrome-extension-v1.2.0...chrome-extension-v1.2.1) (2026-10-23)


### Bug Fixes

* **deps:** resolve audit advisories ([8bc0271](https://github.com/andrewshell/pinsquirrel/commit/8bc027141154dceefaaac3e2b8d6486c4d38073a))

## [1.2.0](https://github.com/andrewshell/pinsquirrel/compare/chrome-extension-v1.1.0...chrome-extension-v1.2.0) (2026-09-11)


### Features

* **extension:** run the consent screen in an ordinary tab ([39b67b2](https://github.com/andrewshell/pinsquirrel/commit/39b67b2d534d3d8bde4d691e5471205d5980acea))

## [1.1.0](https://github.com/andrewshell/pinsquirrel/compare/chrome-extension-v1.0.0...chrome-extension-v1.1.0) (2026-09-11)


### Features

* **extension:** fix the extension ID and attach the zip to each release ([725e545](https://github.com/andrewshell/pinsquirrel/commit/725e545f9e4f80ff8875b300fbaa6658c40f2a97))


### Bug Fixes

* **extension:** render the 48 and 128 icons from vector art ([3a955c7](https://github.com/andrewshell/pinsquirrel/commit/3a955c77faea691e807ea204e372efe8bc31e86d))

## 1.0.0 (2026-09-10)


### Features

* add a root extension:package script for the store zip ([24a1eb6](https://github.com/andrewshell/pinsquirrel/commit/24a1eb6b390019e85c7a28757833e1e1c297a94d))
* **extension:** package a store-ready zip with a release manifest ([dac939b](https://github.com/andrewshell/pinsquirrel/commit/dac939b860d20baa356816815b03f9e0c3dc1611))


### Miscellaneous Chores

* **extension:** start the store versions at 1.0.0 ([1d7aee1](https://github.com/andrewshell/pinsquirrel/commit/1d7aee130311c0828c6cd202657e816330595e16))
