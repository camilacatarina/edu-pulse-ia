/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell, NavSectionId } from './components/layout/AppShell';
import { ActivitiesAssessmentsModule } from './components/modules/ActivitiesAssessmentsModule';
import { OnboardingView } from './components/modules/OnboardingView';
import { OverviewModule } from './components/modules/OverviewModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { StudentsClassesModule } from './components/modules/StudentsClassesModule';
import { StudentPortalView } from './components/modules/StudentPortalView';
import { SupportAndPathsModule } from './components/modules/SupportAndPathsModule';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';

const MainWorkspace: React.FC = () => {
  const { mode, needsOnboarding, effectiveRole } = useWorkspace();
  const [activeTab, setActiveTab] = useState<NavSectionId>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  if (mode === 'LIVE' && needsOnboarding) {
    return <OnboardingView />;
  }

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('students');
  };

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        if (tab !== 'students') {
          setSelectedStudentId(null);
        }
      }}
    >
      {effectiveRole === 'STUDENT' ? (
        <StudentPortalView />
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewModule
              onNavigate={(tab) => setActiveTab(tab as NavSectionId)}
              onSelectStudent={handleSelectStudent}
            />
          )}
          {activeTab === 'students' && (
            <StudentsClassesModule
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
            />
          )}
          {activeTab === 'activities' && <ActivitiesAssessmentsModule />}
          {activeTab === 'support' && <SupportAndPathsModule />}
          {activeTab === 'settings' && <SettingsModule />}
        </>
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <MainWorkspace />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
