/**
 * WCAG 2.2 criteria database - bundled, no external dependency.
 *
 * Contains all WCAG 2.2 success criteria organized by principle and guideline.
 * Source: https://www.w3.org/TR/WCAG22/
 */

export type WcagLevel = 'A' | 'AA' | 'AAA';

export interface WcagGuideline {
  id: string;
  ref: string;
  title: string;
}

export interface WcagCriterion {
  id: string;
  ref: string;
  title: string;
  level: WcagLevel;
  guidelineId: string;
  principleId: string;
  description: string;
  url: string;
}

export interface WcagPrinciple {
  id: string;
  ref: string;
  title: string;
  guidelines: WcagGuideline[];
}

/* -------------------------------------------------------------------------- */
/* Principles & Guidelines                                                     */
/* -------------------------------------------------------------------------- */

export const WCAG_PRINCIPLES: WcagPrinciple[] = [
  {
    id: 'perceivable',
    ref: '1',
    title: 'Perceivable',
    guidelines: [
      { id: 'text-alternatives', ref: '1.1', title: 'Text Alternatives' },
      { id: 'time-based-media', ref: '1.2', title: 'Time-based Media' },
      { id: 'adaptable', ref: '1.3', title: 'Adaptable' },
      { id: 'distinguishable', ref: '1.4', title: 'Distinguishable' },
    ],
  },
  {
    id: 'operable',
    ref: '2',
    title: 'Operable',
    guidelines: [
      { id: 'keyboard-accessible', ref: '2.1', title: 'Keyboard Accessible' },
      { id: 'enough-time', ref: '2.2', title: 'Enough Time' },
      { id: 'seizures-physical', ref: '2.3', title: 'Seizures and Physical Reactions' },
      { id: 'navigable', ref: '2.4', title: 'Navigable' },
      { id: 'input-modalities', ref: '2.5', title: 'Input Modalities' },
    ],
  },
  {
    id: 'understandable',
    ref: '3',
    title: 'Understandable',
    guidelines: [
      { id: 'readable', ref: '3.1', title: 'Readable' },
      { id: 'predictable', ref: '3.2', title: 'Predictable' },
      { id: 'input-assistance', ref: '3.3', title: 'Input Assistance' },
    ],
  },
  {
    id: 'robust',
    ref: '4',
    title: 'Robust',
    guidelines: [
      { id: 'compatible', ref: '4.1', title: 'Compatible' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Success Criteria                                                            */
/* -------------------------------------------------------------------------- */

export const WCAG_CRITERIA: WcagCriterion[] = [
  // 1.1 Text Alternatives
  { id: '1.1.1', ref: '1.1.1', title: 'Non-text Content', level: 'A', guidelineId: 'text-alternatives', principleId: 'perceivable', description: 'All non-text content that is presented to the user has a text alternative that serves the equivalent purpose.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content' },

  // 1.2 Time-based Media
  { id: '1.2.1', ref: '1.2.1', title: 'Audio-only and Video-only (Prerecorded)', level: 'A', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'For prerecorded audio-only and prerecorded video-only media, an alternative is provided.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded' },
  { id: '1.2.2', ref: '1.2.2', title: 'Captions (Prerecorded)', level: 'A', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'Captions are provided for all prerecorded audio content in synchronized media.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded' },
  { id: '1.2.3', ref: '1.2.3', title: 'Audio Description or Media Alternative (Prerecorded)', level: 'A', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'An alternative for time-based media or audio description of the prerecorded video content is provided.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-description-or-media-alternative-prerecorded' },
  { id: '1.2.4', ref: '1.2.4', title: 'Captions (Live)', level: 'AA', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'Captions are provided for all live audio content in synchronized media.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-live' },
  { id: '1.2.5', ref: '1.2.5', title: 'Audio Description (Prerecorded)', level: 'AA', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'Audio description is provided for all prerecorded video content in synchronized media.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded' },
  { id: '1.2.6', ref: '1.2.6', title: 'Sign Language (Prerecorded)', level: 'AAA', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'Sign language interpretation is provided for all prerecorded audio content in synchronized media.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/sign-language-prerecorded' },
  { id: '1.2.7', ref: '1.2.7', title: 'Extended Audio Description (Prerecorded)', level: 'AAA', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'Extended audio description is provided for all prerecorded video content.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/extended-audio-description-prerecorded' },
  { id: '1.2.8', ref: '1.2.8', title: 'Media Alternative (Prerecorded)', level: 'AAA', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'An alternative for time-based media is provided for all prerecorded synchronized media.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded' },
  { id: '1.2.9', ref: '1.2.9', title: 'Audio-only (Live)', level: 'AAA', guidelineId: 'time-based-media', principleId: 'perceivable', description: 'An alternative for time-based media that presents equivalent information is provided for live audio-only content.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-only-live' },

  // 1.3 Adaptable
  { id: '1.3.1', ref: '1.3.1', title: 'Info and Relationships', level: 'A', guidelineId: 'adaptable', principleId: 'perceivable', description: 'Information, structure, and relationships conveyed through presentation can be programmatically determined.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships' },
  { id: '1.3.2', ref: '1.3.2', title: 'Meaningful Sequence', level: 'A', guidelineId: 'adaptable', principleId: 'perceivable', description: 'When the sequence in which content is presented affects its meaning, a correct reading sequence can be programmatically determined.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence' },
  { id: '1.3.3', ref: '1.3.3', title: 'Sensory Characteristics', level: 'A', guidelineId: 'adaptable', principleId: 'perceivable', description: 'Instructions provided for understanding and operating content do not rely solely on sensory characteristics.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics' },
  { id: '1.3.4', ref: '1.3.4', title: 'Orientation', level: 'AA', guidelineId: 'adaptable', principleId: 'perceivable', description: 'Content does not restrict its use to a single display orientation, such as portrait or landscape.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/orientation' },
  { id: '1.3.5', ref: '1.3.5', title: 'Identify Input Purpose', level: 'AA', guidelineId: 'adaptable', principleId: 'perceivable', description: 'The purpose of each input field can be programmatically determined when the field serves a known purpose.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose' },
  { id: '1.3.6', ref: '1.3.6', title: 'Identify Purpose', level: 'AAA', guidelineId: 'adaptable', principleId: 'perceivable', description: 'The purpose of user interface components can be programmatically determined.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-purpose' },

  // 1.4 Distinguishable
  { id: '1.4.1', ref: '1.4.1', title: 'Use of Color', level: 'A', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Color is not used as the only visual means of conveying information.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/use-of-color' },
  { id: '1.4.2', ref: '1.4.2', title: 'Audio Control', level: 'A', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'If audio plays automatically for more than 3 seconds, a mechanism is available to pause or stop it.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-control' },
  { id: '1.4.3', ref: '1.4.3', title: 'Contrast (Minimum)', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Visual presentation of text has a contrast ratio of at least 4.5:1 (3:1 for large text).', url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum' },
  { id: '1.4.4', ref: '1.4.4', title: 'Resize Text', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Text can be resized up to 200 percent without loss of content or functionality.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/resize-text' },
  { id: '1.4.5', ref: '1.4.5', title: 'Images of Text', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Images of text are avoided, except for pure decoration or where essential.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/images-of-text' },
  { id: '1.4.6', ref: '1.4.6', title: 'Contrast (Enhanced)', level: 'AAA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Visual presentation of text has a contrast ratio of at least 7:1 (4.5:1 for large text).', url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced' },
  { id: '1.4.7', ref: '1.4.7', title: 'Low or No Background Audio', level: 'AAA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'For prerecorded audio-only content, background sounds are at least 20 dB below the foreground.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/low-or-no-background-audio' },
  { id: '1.4.8', ref: '1.4.8', title: 'Visual Presentation', level: 'AAA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Text blocks can be customized for width, line spacing, and color without losing information.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation' },
  { id: '1.4.9', ref: '1.4.9', title: 'Images of Text (No Exception)', level: 'AAA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Images of text are only used for pure decoration or where essential.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/images-of-text-no-exception' },
  { id: '1.4.10', ref: '1.4.10', title: 'Reflow', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Content reflows to a single column at 320 CSS pixels without loss of content or functionality.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow' },
  { id: '1.4.11', ref: '1.4.11', title: 'Non-text Contrast', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Visual information required to identify UI components and states has a contrast ratio of at least 3:1.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast' },
  { id: '1.4.12', ref: '1.4.12', title: 'Text Spacing', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Text spacing can be overridden without loss of content or functionality.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/text-spacing' },
  { id: '1.4.13', ref: '1.4.13', title: 'Content on Hover or Focus', level: 'AA', guidelineId: 'distinguishable', principleId: 'perceivable', description: 'Content appearing on hover or focus is dismissible, hoverable, and persistent.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus' },

  // 2.1 Keyboard Accessible
  { id: '2.1.1', ref: '2.1.1', title: 'Keyboard', level: 'A', guidelineId: 'keyboard-accessible', principleId: 'operable', description: 'All functionality is operable from a keyboard interface.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard' },
  { id: '2.1.2', ref: '2.1.2', title: 'No Keyboard Trap', level: 'A', guidelineId: 'keyboard-accessible', principleId: 'operable', description: 'Focus can be moved away from a component using only a keyboard interface.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap' },
  { id: '2.1.3', ref: '2.1.3', title: 'Keyboard (No Exception)', level: 'AAA', guidelineId: 'keyboard-accessible', principleId: 'operable', description: 'All functionality is operable from a keyboard without exception.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard-no-exception' },
  { id: '2.1.4', ref: '2.1.4', title: 'Character Key Shortcuts', level: 'A', guidelineId: 'keyboard-accessible', principleId: 'operable', description: 'Single-character shortcuts can be turned off, remapped, or only active on focus.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts' },

  // 2.2 Enough Time
  { id: '2.2.1', ref: '2.2.1', title: 'Timing Adjustable', level: 'A', guidelineId: 'enough-time', principleId: 'operable', description: 'Users can turn off, adjust, or extend time limits.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable' },
  { id: '2.2.2', ref: '2.2.2', title: 'Pause, Stop, Hide', level: 'A', guidelineId: 'enough-time', principleId: 'operable', description: 'Moving, blinking, scrolling, or auto-updating content can be paused, stopped, or hidden.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide' },
  { id: '2.2.3', ref: '2.2.3', title: 'No Timing', level: 'AAA', guidelineId: 'enough-time', principleId: 'operable', description: 'Timing is not an essential part of the event or activity.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/no-timing' },
  { id: '2.2.4', ref: '2.2.4', title: 'Interruptions', level: 'AAA', guidelineId: 'enough-time', principleId: 'operable', description: 'Interruptions can be postponed or suppressed by the user.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/interruptions' },
  { id: '2.2.5', ref: '2.2.5', title: 'Re-authenticating', level: 'AAA', guidelineId: 'enough-time', principleId: 'operable', description: 'Re-authentication does not erase data when an authenticated session expires.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/re-authenticating' },
  { id: '2.2.6', ref: '2.2.6', title: 'Timeouts', level: 'AAA', guidelineId: 'enough-time', principleId: 'operable', description: 'Users are warned of timeouts that could cause data loss.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/timeouts' },

  // 2.3 Seizures and Physical Reactions
  { id: '2.3.1', ref: '2.3.1', title: 'Three Flashes or Below Threshold', level: 'A', guidelineId: 'seizures-physical', principleId: 'operable', description: 'Content does not contain anything that flashes more than three times per second.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold' },
  { id: '2.3.2', ref: '2.3.2', title: 'Three Flashes', level: 'AAA', guidelineId: 'seizures-physical', principleId: 'operable', description: 'Content does not contain anything that flashes more than three times in any one-second period.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/three-flashes' },
  { id: '2.3.3', ref: '2.3.3', title: 'Animation from Interactions', level: 'AAA', guidelineId: 'seizures-physical', principleId: 'operable', description: 'Motion animation can be disabled by the user.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions' },

  // 2.4 Navigable
  { id: '2.4.1', ref: '2.4.1', title: 'Bypass Blocks', level: 'A', guidelineId: 'navigable', principleId: 'operable', description: 'A mechanism is available to bypass blocks of content that are repeated on multiple pages.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks' },
  { id: '2.4.2', ref: '2.4.2', title: 'Page Titled', level: 'A', guidelineId: 'navigable', principleId: 'operable', description: 'Web pages have titles that describe topic or purpose.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled' },
  { id: '2.4.3', ref: '2.4.3', title: 'Focus Order', level: 'A', guidelineId: 'navigable', principleId: 'operable', description: 'Components receive focus in an order that preserves meaning and operability.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order' },
  { id: '2.4.4', ref: '2.4.4', title: 'Link Purpose (In Context)', level: 'A', guidelineId: 'navigable', principleId: 'operable', description: 'The purpose of each link can be determined from the link text or context.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context' },
  { id: '2.4.5', ref: '2.4.5', title: 'Multiple Ways', level: 'AA', guidelineId: 'navigable', principleId: 'operable', description: 'More than one way is available to locate a web page within a set of pages.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways' },
  { id: '2.4.6', ref: '2.4.6', title: 'Headings and Labels', level: 'AA', guidelineId: 'navigable', principleId: 'operable', description: 'Headings and labels describe topic or purpose.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels' },
  { id: '2.4.7', ref: '2.4.7', title: 'Focus Visible', level: 'AA', guidelineId: 'navigable', principleId: 'operable', description: 'Any keyboard operable user interface has a visible focus indicator.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible' },
  { id: '2.4.8', ref: '2.4.8', title: 'Location', level: 'AAA', guidelineId: 'navigable', principleId: 'operable', description: 'Information about the user\'s location within a set of pages is available.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/location' },
  { id: '2.4.9', ref: '2.4.9', title: 'Link Purpose (Link Only)', level: 'AAA', guidelineId: 'navigable', principleId: 'operable', description: 'The purpose of each link can be determined from link text alone.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only' },
  { id: '2.4.10', ref: '2.4.10', title: 'Section Headings', level: 'AAA', guidelineId: 'navigable', principleId: 'operable', description: 'Section headings are used to organize the content.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/section-headings' },
  { id: '2.4.11', ref: '2.4.11', title: 'Focus Not Obscured (Minimum)', level: 'AA', guidelineId: 'navigable', principleId: 'operable', description: 'When a component receives focus, it is not entirely hidden.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum' },
  { id: '2.4.12', ref: '2.4.12', title: 'Focus Not Obscured (Enhanced)', level: 'AAA', guidelineId: 'navigable', principleId: 'operable', description: 'When a component receives focus, no part of it is hidden.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-enhanced' },
  { id: '2.4.13', ref: '2.4.13', title: 'Focus Appearance', level: 'AAA', guidelineId: 'navigable', principleId: 'operable', description: 'When the keyboard focus indicator is visible, it meets specific size and contrast requirements.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance' },

  // 2.5 Input Modalities
  { id: '2.5.1', ref: '2.5.1', title: 'Pointer Gestures', level: 'A', guidelineId: 'input-modalities', principleId: 'operable', description: 'All functionality can be operated with a single pointer without path-based gestures.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures' },
  { id: '2.5.2', ref: '2.5.2', title: 'Pointer Cancellation', level: 'A', guidelineId: 'input-modalities', principleId: 'operable', description: 'Users can abort pointer actions and undo accidental activations.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation' },
  { id: '2.5.3', ref: '2.5.3', title: 'Label in Name', level: 'A', guidelineId: 'input-modalities', principleId: 'operable', description: 'For user interface components with labels, the accessible name contains the visible label text.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/label-in-name' },
  { id: '2.5.4', ref: '2.5.4', title: 'Motion Actuation', level: 'A', guidelineId: 'input-modalities', principleId: 'operable', description: 'Functionality triggered by motion can also be operated through a user interface component.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation' },
  { id: '2.5.5', ref: '2.5.5', title: 'Target Size (Enhanced)', level: 'AAA', guidelineId: 'input-modalities', principleId: 'operable', description: 'Targets are at least 44 by 44 CSS pixels.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced' },
  { id: '2.5.6', ref: '2.5.6', title: 'Concurrent Input Mechanisms', level: 'AAA', guidelineId: 'input-modalities', principleId: 'operable', description: 'Web content does not restrict use of input modalities available on the platform.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/concurrent-input-mechanisms' },
  { id: '2.5.7', ref: '2.5.7', title: 'Dragging Movements', level: 'AA', guidelineId: 'input-modalities', principleId: 'operable', description: 'Functionality that uses dragging movements can also be achieved by a single pointer without dragging.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements' },
  { id: '2.5.8', ref: '2.5.8', title: 'Target Size (Minimum)', level: 'AA', guidelineId: 'input-modalities', principleId: 'operable', description: 'Targets are at least 24 by 24 CSS pixels, except where spacing is sufficient.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum' },

  // 3.1 Readable
  { id: '3.1.1', ref: '3.1.1', title: 'Language of Page', level: 'A', guidelineId: 'readable', principleId: 'understandable', description: 'The default human language of each page can be programmatically determined.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page' },
  { id: '3.1.2', ref: '3.1.2', title: 'Language of Parts', level: 'AA', guidelineId: 'readable', principleId: 'understandable', description: 'The human language of each passage or phrase can be programmatically determined.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts' },
  { id: '3.1.3', ref: '3.1.3', title: 'Unusual Words', level: 'AAA', guidelineId: 'readable', principleId: 'understandable', description: 'A mechanism is available for identifying specific definitions of words or phrases.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/unusual-words' },
  { id: '3.1.4', ref: '3.1.4', title: 'Abbreviations', level: 'AAA', guidelineId: 'readable', principleId: 'understandable', description: 'A mechanism for identifying the expanded form or meaning of abbreviations is available.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/abbreviations' },
  { id: '3.1.5', ref: '3.1.5', title: 'Reading Level', level: 'AAA', guidelineId: 'readable', principleId: 'understandable', description: 'Text requires reading ability at the lower secondary education level, or provides a simplified version.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/reading-level' },
  { id: '3.1.6', ref: '3.1.6', title: 'Pronunciation', level: 'AAA', guidelineId: 'readable', principleId: 'understandable', description: 'A mechanism is available for determining the correct pronunciation of words.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/pronunciation' },

  // 3.2 Predictable
  { id: '3.2.1', ref: '3.2.1', title: 'On Focus', level: 'A', guidelineId: 'predictable', principleId: 'understandable', description: 'When a component receives focus, it does not initiate a change of context.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/on-focus' },
  { id: '3.2.2', ref: '3.2.2', title: 'On Input', level: 'A', guidelineId: 'predictable', principleId: 'understandable', description: 'Changing the setting of a UI component does not automatically cause a change of context.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/on-input' },
  { id: '3.2.3', ref: '3.2.3', title: 'Consistent Navigation', level: 'AA', guidelineId: 'predictable', principleId: 'understandable', description: 'Navigational mechanisms are repeated on multiple pages in a consistent order.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation' },
  { id: '3.2.4', ref: '3.2.4', title: 'Consistent Identification', level: 'AA', guidelineId: 'predictable', principleId: 'understandable', description: 'Components with the same functionality are identified consistently.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification' },
  { id: '3.2.5', ref: '3.2.5', title: 'Change on Request', level: 'AAA', guidelineId: 'predictable', principleId: 'understandable', description: 'Changes of context are only initiated by user request or with a mechanism to turn them off.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/change-on-request' },
  { id: '3.2.6', ref: '3.2.6', title: 'Consistent Help', level: 'A', guidelineId: 'predictable', principleId: 'understandable', description: 'Help mechanisms are placed in the same relative order across pages.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-help' },

  // 3.3 Input Assistance
  { id: '3.3.1', ref: '3.3.1', title: 'Error Identification', level: 'A', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Input errors are automatically detected and described to the user in text.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/error-identification' },
  { id: '3.3.2', ref: '3.3.2', title: 'Labels or Instructions', level: 'A', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Labels or instructions are provided when content requires user input.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions' },
  { id: '3.3.3', ref: '3.3.3', title: 'Error Suggestion', level: 'AA', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Suggestions for correcting input errors are provided.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion' },
  { id: '3.3.4', ref: '3.3.4', title: 'Error Prevention (Legal, Financial, Data)', level: 'AA', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Submissions are reversible, checked, and confirmed for legal/financial transactions.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data' },
  { id: '3.3.5', ref: '3.3.5', title: 'Help', level: 'AAA', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Context-sensitive help is available.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/help' },
  { id: '3.3.6', ref: '3.3.6', title: 'Error Prevention (All)', level: 'AAA', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Submissions are reversible, checked, and confirmed for all submissions.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-all' },
  { id: '3.3.7', ref: '3.3.7', title: 'Redundant Entry', level: 'A', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Information previously entered is auto-populated or available for selection.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry' },
  { id: '3.3.8', ref: '3.3.8', title: 'Accessible Authentication (Minimum)', level: 'AA', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Authentication does not require cognitive function tests unless an alternative is provided.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum' },
  { id: '3.3.9', ref: '3.3.9', title: 'Accessible Authentication (Enhanced)', level: 'AAA', guidelineId: 'input-assistance', principleId: 'understandable', description: 'Authentication does not require cognitive function tests.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-enhanced' },

  // 4.1 Compatible
  { id: '4.1.2', ref: '4.1.2', title: 'Name, Role, Value', level: 'A', guidelineId: 'compatible', principleId: 'robust', description: 'For all UI components, the name, role, and value can be programmatically determined and set.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value' },
  { id: '4.1.3', ref: '4.1.3', title: 'Status Messages', level: 'AA', guidelineId: 'compatible', principleId: 'robust', description: 'Status messages can be programmatically determined through role or properties without receiving focus.', url: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages' },
];

export const WCAG_LEVELS: WcagLevel[] = ['A', 'AA', 'AAA'];

export const WCAG_LEVEL_COUNTS: Record<WcagLevel, number> = {
  A: WCAG_CRITERIA.filter(c => c.level === 'A').length,
  AA: WCAG_CRITERIA.filter(c => c.level === 'AA').length,
  AAA: WCAG_CRITERIA.filter(c => c.level === 'AAA').length,
};
