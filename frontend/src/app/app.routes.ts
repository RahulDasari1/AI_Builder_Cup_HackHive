import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const routes: Routes = [
  { path: '', component: AppComponent },
  { path: 'student', component: AppComponent },
  { path: 'teacher', component: AppComponent },
  { path: 'admin', component: AppComponent },
  { path: 'overview', component: AppComponent },
  { path: 'learning', component: AppComponent },
  { path: 'assessments', component: AppComponent },
  { path: 'reports', component: AppComponent },
  { path: '**', redirectTo: '' }
];
