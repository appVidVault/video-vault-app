import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { User } from '@/entities/User';

export default function ThemeReport() {
  const [diagnostics, setDiagnostics] = React.useState({
    themeDetected: null,
    cssVariablesApplied: false,
    themeMappedCorrectly: false,
    userSettingsSaved: null,
    bodyHasThemeClass: false,
    availableThemeClasses: [],
    detectedUserTheme: 'unknown',
    success: false,
    loading: true
  });

  const allPossibleThemeClasses = [
    'theme-default', 'theme-dark', 'theme-retrowave',
    'theme-forest', 'theme-ocean', 'theme-candy', 'theme-neon',
    'theme-lavender-bliss', 'theme-minty-fresh', 'theme-peachy-keen'
  ];

  React.useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    try {
      // Get computed style values
      const rootStyles = getComputedStyle(document.documentElement);
      const bodyStyles = getComputedStyle(document.body);
      
      // Check background color to see if theme variables are applied
      const background = rootStyles.getPropertyValue('--background').trim();
      const foreground = rootStyles.getPropertyValue('--foreground').trim();
      
      // Get user settings from database
      let userSettings = null;
      let userTheme = 'default';
      try {
        const user = await User.me();
        userSettings = user?.settings || null;
        userTheme = userSettings?.theme || 'default';
      } catch (error) {
        console.error("Error fetching user:", error);
      }
      
      // Check for theme class on html element
      const htmlClassList = document.documentElement.classList;
      
      // Find theme classes in HTML element
      const currentHtmlThemeClasses = [];
      htmlClassList.forEach(className => {
        if (className.startsWith('theme-')) {
          currentHtmlThemeClasses.push(className);
        }
      });
      
      // Check if body background matches theme
      const bodyBackgroundColor = bodyStyles.backgroundColor;
      
      // Determine if the detected values match what we expect
      const cssVariablesApplied = !!background && !!foreground;
      const themeMappedCorrectly = background !== '' && background !== 'transparent';
      const bodyHasThemeColor = bodyBackgroundColor && bodyBackgroundColor !== 'rgba(0, 0, 0, 0)';
      
      setDiagnostics({
        themeDetected: currentHtmlThemeClasses.length > 0,
        cssVariablesApplied,
        themeMappedCorrectly,
        userSettingsSaved: userSettings !== null,
        bodyHasThemeClass: bodyHasThemeColor,
        availableThemeClasses: currentHtmlThemeClasses, // Show what's actually on the HTML element
        detectedUserTheme: userTheme,
        success: cssVariablesApplied && themeMappedCorrectly && currentHtmlThemeClasses.includes(`theme-${userTheme}`),
        loading: false
      });
      
    } catch (error) {
      console.error("Error running diagnostics:", error);
      setDiagnostics(prev => ({
        ...prev,
        success: false,
        error: error.message,
        loading: false
      }));
    }
  };

  const fixThemeIssue = async () => {
    try {
      // Get user settings
      const user = await User.me();
      const currentTheme = user?.settings?.theme || 'default';
      
      // Apply the theme by adding classes directly to the root element
      const root = document.documentElement;
      allPossibleThemeClasses.forEach(tClass => root.classList.remove(tClass));
      root.classList.add(`theme-${currentTheme}`);
      
      // Force style recalculation
      document.documentElement.style.backgroundColor = ''; // This might not be necessary with class manipulation
      
      // Re-run diagnostics
      setTimeout(runDiagnostics, 500);
      
      return true;
    } catch (error) {
      console.error("Error fixing theme:", error);
      return false;
    }
  };

  const refreshTheme = () => {
    // Force a re-render of the component and re-run diagnostics
    setDiagnostics(prev => ({ ...prev, loading: true }));
    setTimeout(runDiagnostics, 100);
  };

  if (diagnostics.loading) {
    return (
      <div className="container p-8 flex justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link to={createPageUrl("Settings")}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Theme Diagnostic Report</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {diagnostics.success ? (
                <Check className="text-green-500 h-6 w-6" />
              ) : (
                <X className="text-red-500 h-6 w-6" />
              )}
              Theme Status
            </CardTitle>
            <CardDescription>
              Current state of theme implementation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Current Theme</h3>
                <div className="p-4 bg-card border rounded-md">
                  <p><strong>Selected theme in settings:</strong> {diagnostics.detectedUserTheme}</p>
                  <p className="mt-1"><strong>Applied theme classes on HTML:</strong> {diagnostics.availableThemeClasses.join(', ') || 'None'}</p>
                </div>
              </div>

              <ul className="space-y-2">
                <DiagnosticItem 
                  label="Theme class detected on HTML element" 
                  status={diagnostics.themeDetected} 
                />
                <DiagnosticItem 
                  label="CSS variables applied" 
                  status={diagnostics.cssVariablesApplied} 
                />
                <DiagnosticItem 
                  label="Theme mapped correctly to styles" 
                  status={diagnostics.themeMappedCorrectly} 
                />
                <DiagnosticItem 
                  label="User settings saved" 
                  status={diagnostics.userSettingsSaved} 
                />
                <DiagnosticItem 
                  label="Body has theme styles" 
                  status={diagnostics.bodyHasThemeClass} 
                />
              </ul>

              <div className="flex gap-4 mt-6">
                <Button onClick={refreshTheme}>
                  Refresh Diagnostics
                </Button>
                <Button onClick={fixThemeIssue} variant="outline">
                  Attempt to Apply Fix
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc pl-5">
              <li>Make sure your theme classes are defined in globals.css</li>
              <li>Check that CSS variables are being properly set in each theme class</li>
              <li>Verify that the theme class is being applied to the HTML element (document.documentElement)</li>
              <li>Try clearing your browser cache or using incognito mode</li>
              <li>Check browser developer console for any errors</li>
              <li>Make sure the theme is being set in user settings</li>
            </ul>

            <h3 className="font-medium mt-4 mb-2">Theme Class Implementation:</h3>
            <pre className="bg-card p-4 rounded-md overflow-auto text-sm">
              {`.theme-{name} {
  --background: #color;
  --foreground: #color;
  --card: #color;
  --card-foreground: #color;
  --border: #color;
  --primary: #color;
  background-color: var(--background);
  color: var(--foreground);
}`}
            </pre>

            <h3 className="font-medium mt-4 mb-2">How to Apply Theme:</h3>
            <pre className="bg-card p-4 rounded-md overflow-auto text-sm">
              {`function applyTheme(theme) {
  const root = document.documentElement;
  // Remove existing theme classes
  const allThemeClasses = ['theme-default', 'theme-dark', 'theme-retrowave', 'theme-forest', 'theme-ocean', 'theme-candy', 'theme-neon', 'theme-lavender-bliss', 'theme-minty-fresh', 'theme-peachy-keen' ];
  allThemeClasses.forEach(tClass => root.classList.remove(tClass));
  // Add selected theme
  root.classList.add(\`theme-\${theme}\`);
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper component for diagnostic items
function DiagnosticItem({ label, status }) {
  return (
    <li className="flex items-center justify-between p-2 border-b">
      <span>{label}</span>
      {status === null ? (
        <span className="text-gray-400">Unknown</span>
      ) : status ? (
        <Check className="text-green-500 h-5 w-5" />
      ) : (
        <X className="text-red-500 h-5 w-5" />
      )}
    </li>
  );
}
