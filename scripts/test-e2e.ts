import fs from "node:fs";

async function runE2ETests() {
  console.log("=== RUNNING COMPLETE END-TO-END SUITE FOR DOCUMENT VERIFICATION WEBAPP ===");
  const baseUrl = "http://localhost:3000";

  const routes = [
    { path: "/", name: "Dashboard Page" },
    { path: "/references", name: "References Page" },
    { path: "/verify", name: "New Verification Page" },
    { path: "/history", name: "History Page" },
    { path: "/settings", name: "Settings Page" },
    { path: "/api/dashboard", name: "Dashboard API" },
    { path: "/api/references", name: "References API" },
    { path: "/api/settings", name: "Settings API" },
    { path: "/api/verifications", name: "Verifications List API" },
  ];

  let passed = 0;
  let failed = 0;

  for (const r of routes) {
    try {
      const res = await fetch(`${baseUrl}${r.path}`);
      if (res.ok) {
        console.log(`[PASS] ${r.name} (${r.path}) -> HTTP ${res.status}`);
        passed += 1;
      } else {
        console.error(`[FAIL] ${r.name} (${r.path}) -> HTTP ${res.status}`);
        failed += 1;
      }
    } catch (err) {
      console.error(`[FAIL] ${r.name} (${r.path}) -> Error:`, err);
      failed += 1;
    }
  }

  // Test Verifying Scanned Document against Active Reference REF-002
  console.log("\n=== TESTING SCANNED DOCUMENT ACCEPTANCE ===");
  const scannedBuf = fs.readFileSync("data/uploads/VER-10002-upload.pdf");
  const blob = new Blob([scannedBuf], { type: "application/pdf" });
  const formData = new FormData();
  formData.append("uploaded_document", blob, "scanned_application_test.pdf");
  formData.append("user_id", "e2e-scanner");
  formData.append("user_name", "E2E Scanned Document Tester");
  formData.append("reference_document_id", "REF-002");

  const verifyRes = await fetch(`${baseUrl}/api/verify-document`, {
    method: "POST",
    body: formData,
  });
  const verifyData = await verifyRes.json();
  console.log("Verification HTTP status:", verifyRes.status);
  console.log("Generated ID:", verifyData.verification_id);
  console.log("Match Percentage:", verifyData.match_percentage + "%");
  console.log("Automated Decision:", verifyData.automated_decision);
  console.log("Final Decision:", verifyData.final_decision);
  console.log("Category Scores:", verifyData.verification?.categoryScores);
  console.log("Critical Issues Count:", verifyData.critical_issues?.length ?? 0);
  console.log("Engine Note:", verifyData.verification?.engineNote);

  if (verifyData.automated_decision === "ACCEPTED" && verifyData.match_percentage >= 85) {
    console.log("[PASS] Scanned document acceptance: ACCEPTED with score >= 85%!");
    passed += 1;
  } else {
    console.error("[FAIL] Scanned document acceptance failed. Decision:", verifyData.automated_decision);
    failed += 1;
  }

  // Test report page for the generated verification
  const reportPath = `/history/${verifyData.verification_id}`;
  const reportRes = await fetch(`${baseUrl}${reportPath}`);
  if (reportRes.ok) {
    console.log(`[PASS] Verification Report Page (${reportPath}) -> HTTP ${reportRes.status}`);
    passed += 1;
  } else {
    console.error(`[FAIL] Verification Report Page (${reportPath}) -> HTTP ${reportRes.status}`);
    failed += 1;
  }

  // Test report API
  const reportApiRes = await fetch(`${baseUrl}/api/verifications/${verifyData.verification_id}`);
  const reportApiData = await reportApiRes.json();
  if (reportApiRes.ok && reportApiData.verification?.id === verifyData.verification_id) {
    console.log(`[PASS] Verification Record API (/api/verifications/${verifyData.verification_id}) -> HTTP 200`);
    passed += 1;
  } else {
    console.error(`[FAIL] Verification Record API (/api/verifications/${verifyData.verification_id})`);
    failed += 1;
  }

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
}

runE2ETests().catch(console.error);
