import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function TestConnection() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runTests = async () => {
    setTesting(true);
    const testResults: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Check environment variables
      testResults.tests.push({
        name: "Environment Variables",
        status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "pass" : "fail",
        details: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
          key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"
        }
      });

      // Test 2: Test auth session
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        testResults.tests.push({
          name: "Auth Session Check",
          status: error ? "fail" : "pass",
          details: {
            session: session ? "✅ Active session" : "⚠️ No active session",
            error: error ? error.message : null
          }
        });
      } catch (error: any) {
        testResults.tests.push({
          name: "Auth Session Check",
          status: "fail",
          details: {
            error: error.message || "Network error"
          }
        });
      }

      // Test 3: Test database connection
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("count")
          .limit(1);

        testResults.tests.push({
          name: "Database Connection",
          status: error ? "fail" : "pass",
          details: {
            connection: error ? "❌ Failed" : "✅ Connected",
            error: error ? error.message : null
          }
        });
      } catch (error: any) {
        testResults.tests.push({
          name: "Database Connection",
          status: "fail",
          details: {
            error: error.message || "Network error"
          }
        });
      }

      // Test 4: Test API endpoint
      try {
        const response = await fetch("/api/admin/test-supabase");
        const data = await response.json();
        testResults.tests.push({
          name: "API Endpoint Test",
          status: response.ok ? "pass" : "fail",
          details: data
        });
      } catch (error: any) {
        testResults.tests.push({
          name: "API Endpoint Test",
          status: "fail",
          details: {
            error: error.message || "Network error"
          }
        });
      }

    } catch (error: any) {
      testResults.error = error.message;
    }

    setResults(testResults);
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Supabase Connection Test</CardTitle>
            <CardDescription>
              Test your Supabase connection and configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Configuration Check</h3>
                  <p className="text-sm text-gray-600">
                    Test Supabase URL: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set"}
                    </code>
                  </p>
                </div>
                <Button onClick={runTests} disabled={testing}>
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Run Tests"
                  )}
                </Button>
              </div>

              {results && (
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-4">Test Results</h4>
                    <div className="space-y-3">
                      {results.tests.map((test: any, index: number) => (
                        <Card key={index} className={test.status === "pass" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              {test.status === "pass" ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <CardTitle className="text-base">{test.name}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-white p-3 rounded border overflow-auto">
                              {JSON.stringify(test.details, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-semibold text-blue-900 mb-2">📋 Next Steps:</h5>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>If Auth Session Check fails: Check Supabase URL Configuration in Dashboard</li>
                      <li>If Database Connection fails: Check RLS policies and table permissions</li>
                      <li>If all tests pass: The connection is working correctly!</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Troubleshooting Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">🔧 Common Issues:</h4>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="font-semibold">NetworkError when fetching:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-gray-700">
                    <li>Project might be paused (check Supabase Dashboard)</li>
                    <li>CORS configuration might be incorrect</li>
                    <li>Site URL not configured in Supabase Authentication settings</li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 p-3 rounded">
                  <p className="font-semibold">How to fix:</p>
                  <ul className="list-decimal list-inside mt-1 space-y-1 text-gray-700">
                    <li>Go to Supabase Dashboard → Authentication → URL Configuration</li>
                    <li>Set Site URL to: <code className="bg-white px-2 py-1 rounded text-xs">https://3000-702ddd5d-9005-4bc3-8d90-c747bb727511.softgen.dev</code></li>
                    <li>Add Redirect URLs with wildcard: <code className="bg-white px-2 py-1 rounded text-xs">https://3000-702ddd5d-9005-4bc3-8d90-c747bb727511.softgen.dev/**</code></li>
                    <li>Click Save and wait 1-2 minutes for changes to propagate</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}