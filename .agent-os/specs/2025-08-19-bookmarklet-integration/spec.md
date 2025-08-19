# Spec Requirements Document

> Spec: Bookmarklet Integration
> Created: 2025-08-19
> Status: Planning

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-19-bookmarklet-integration/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-19-bookmarklet-integration/sub-specs/technical-spec.md
- Tests Specification: @.agent-os/specs/2025-08-19-bookmarklet-integration/sub-specs/tests.md

## Overview

Implement a bookmarklet feature that allows users to quickly pin any webpage from their browser, providing the bookmarklet code on the profile page for easy installation and automatically pre-filling the pin creation form with page metadata and selected text.

## User Stories

### Quick Pin Creation from Any Website

As a content curator, I want to quickly save interesting articles and pages I find while browsing, so that I can capture valuable content without interrupting my browsing flow.

The user visits their PinSquirrel profile page, drags the provided bookmarklet to their bookmarks bar, then clicks it while on any webpage to instantly open a new tab with the pin creation form pre-filled with the current page's URL, title, and description. If text is selected on the page, it uses that as the description (converted to markdown) instead of the meta description.

### Easy Bookmarklet Installation

As a PinSquirrel user, I want to easily install a bookmarklet tool, so that I can access PinSquirrel's pin creation functionality from any website without having to manually copy and paste URLs and information.

The profile page displays the bookmarklet code with clear instructions for dragging it to the bookmarks bar, ensuring users can quickly set up this productivity tool.

## Spec Scope

1. **Bookmarklet Code Generation** - Create JavaScript bookmarklet code that captures page metadata and opens PinSquirrel
2. **Profile Page Integration** - Display the bookmarklet on the profile page with installation instructions  
3. **Pre-filled Pin Form** - Accept URL parameters to pre-populate the pin creation form with title, URL, and description
4. **Selected Text Handling** - Convert selected text to markdown and use as description when available
5. **Authentication Check** - Ensure user is logged in when accessing pre-filled pin creation

## Out of Scope

- Browser extension development
- Popup/modal overlay on external websites
- Offline bookmarklet functionality
- Bookmarklet customization options
- Bulk pin creation from bookmarklet

## Expected Deliverable

1. Profile page displays a draggable bookmarklet link with clear installation instructions
2. Bookmarklet opens new PinSquirrel tab with URL, title, and description pre-filled from the source page
3. Selected text on source page is converted to markdown and used as description when present