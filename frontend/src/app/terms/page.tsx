import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, REPO_URL } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service · Web Collector' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>By using Web Collector, the website or the desktop app, you agree to these terms.</p>

      <section>
        <h2>The service</h2>
        <p>
          Web Collector is a free personal project. It is provided as it is, without any guarantee that it will always be
          available or free of errors. Features may change, and the service may end. Keep your own copy of important links;
          you can export them from the app at any time.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>Keep your password to yourself. You are responsible for what is done with your account.</p>
      </section>

      <section>
        <h2>What you post</h2>
        <ul>
          <li>You are responsible for the links you save and the messages you send.</li>
          <li>
            In the community room and chats, do not post anything illegal, hateful, harassing, sexual, or spam, or links to
            harmful sites.
          </li>
          <li>Messages or accounts that break these rules may be removed without notice.</li>
        </ul>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          How your information is handled is described in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions can be sent through the <a href={REPO_URL}>project page on GitHub</a>.
        </p>
      </section>
    </LegalPage>
  );
}
