import { Routes } from '@angular/router';
import { HomeComponent } from './components/home.component';
import { DashboardComponent } from './components/dashboard.component';
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'meeting/:id/organizer', component: DashboardComponent, data: { role: 'organizer' } },
  { path: 'meeting/:id/visitor', component: DashboardComponent, data: { role: 'visitor' } },
  { path: '**', redirectTo: '' }
];
