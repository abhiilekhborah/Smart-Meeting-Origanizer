import { Routes } from '@angular/router';
import { HomeComponent } from './components/home.component';
import { JoinPageComponent } from './components/join-page.component';
import { SummaryPageComponent } from './components/summary-page.component';
import { DashboardComponent } from './components/dashboard.component';
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'join/:code', component: JoinPageComponent },
  { path: 'meeting/:id/summary', component: SummaryPageComponent },
  { path: 'meeting/:id/organizer', component: DashboardComponent, data: { role: 'organizer' } },
  { path: 'meeting/:id/visitor', component: DashboardComponent, data: { role: 'visitor' } },
  { path: '**', redirectTo: '' }
];
