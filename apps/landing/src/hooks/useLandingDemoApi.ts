"use client";

import { useLayoutEffect } from "react";
import type { LandingLanguage } from "@landing/lib/landingLanguage";
import { demoFetchResponse, jsonResponse } from "@landing/utils/landingDemo";

export function useLandingDemoApi(language: LandingLanguage) {
  // Install before child passive effects request models/settings. The landing
  // has no app API routes; mounting children first causes real 404 requests.
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const demoResponse = url.origin === window.location.origin
        ? demoFetchResponse(url.pathname, init, language)
        : null;
      if (demoResponse) return demoResponse;
      if (url.origin === "http://127.0.0.1:8765") {
        return jsonResponse({ result: [12345, 12346, 12347], error: null });
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [language]);
}
