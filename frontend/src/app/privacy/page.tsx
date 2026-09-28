import type { Metadata } from 'next';
import { LegalPage, REPO_URL } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy · Web Collector' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Web Collector is a personal bookmark manager. This page explains what it stores about you, why, and how to have it
        removed. We do not sell your information, show ads, or use analytics or tracking tools.
      </p>

      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            <b>Your account:</b> username and email. Your password is stored only as a one-way hash, never as plain text.
          </li>
          <li>
            <b>Google sign-in:</b> if you sign in with Google, we receive only your email address and name. We never see
            your Google password and cannot access anything else in your Google account.
          </li>
          <li>
            <b>What you save:</b> links, categories, macros and memos.
          </li>
          <li>
            <b>Social features:</b> your public @ID, friend requests, chat rooms, and the messages you send in chats and the
            community room.
          </li>
          <li>
            <b>Appearance settings</b> (theme, card style) stay in your own browser and are not sent to us.
          </li>
        </ul>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>Your links, categories and memos are visible only to you.</li>
          <li>Your @ID can be found by other signed-in people so they can add you as a friend.</li>
          <li>Community messages are visible to everyone who is signed in. Chat room messages are visible to the room&apos;s members.</li>
        </ul>
      </section>

      <section>
        <h2>Where it is kept</h2>
        <p>
          Data is stored in a Supabase database in Seoul, South Korea, and the website runs on Vercel. To show site icons,
          the address of each saved site (for example <code>example.com</code>) is sent to Google&apos;s public icon service.
          The extra chat fonts are downloaded from Google Fonts when you open the chat settings or use one of them. The
          desktop app checks GitHub for new versions.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use one cookie, which keeps you signed in for up to 7 days. It cannot be read by scripts on the page and is not
          used for anything else.
        </p>
      </section>

      <section>
        <h2>Deleting your data</h2>
        <p>
          You can delete your links, categories and messages at any time in the app. To delete your whole account, contact
          the site owner through the <a href={REPO_URL}>project page on GitHub</a>, and your account and everything linked to
          it will be removed.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes, the date at the top of this page will be updated.</p>
      </section>
    </LegalPage>
  );
}
