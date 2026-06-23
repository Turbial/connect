# Current Sprint — Command Router

**Goal:** Connect routes "analyze this file" to Result engine.

- Extract intent classification into mighty-core/messenger package
- Connect webhook receives message, classifies intent, routes to target
- Test with manual curl against connect.turbial.com

**Blockers:** Missing env vars (provider credentials not set).
