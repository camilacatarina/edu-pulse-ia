import {
  ActivityType,
  DifficultyLevel,
  EngineSource,
  InterventionStatus,
  LearningEventType,
  PedagogicalStatus,
  PriorityLevel,
  UserRole,
} from '../types/domain';

export function labelPedagogicalStatus(status: PedagogicalStatus): string {
  switch (status) {
    case 'Mastering':
      return 'Domínio Consolidado';
    case 'Progressing':
      return 'Em Progresso';
    case 'Needs Reinforcement':
      return 'Necessita Reforço';
    case 'Additional Practice Recommended':
      return 'Prática Adicional Recomendada';
  }
}

export function labelDifficulty(level: DifficultyLevel): string {
  switch (level) {
    case 'Foundational':
      return 'Básico';
    case 'Intermediate':
      return 'Intermediário';
    case 'Advanced':
      return 'Avançado';
  }
}

export function labelEstimatedLevel(
  level: 'Foundational' | 'Developing' | 'Proficient' | 'Mastering'
): string {
  switch (level) {
    case 'Foundational':
      return 'Inicial';
    case 'Developing':
      return 'Em Desenvolvimento';
    case 'Proficient':
      return 'Proficiente';
    case 'Mastering':
      return 'Domínio';
  }
}

export function labelActivityType(type: ActivityType): string {
  switch (type) {
    case 'Multiple Choice':
      return 'Múltipla Escolha';
    case 'True or False':
      return 'Verdadeiro ou Falso';
    case 'Short Answer':
      return 'Resposta Discursiva';
    case 'Practice Exercises':
      return 'Exercícios Práticos';
    case 'Diagnostic Assessment':
      return 'Avaliação Diagnóstica';
    case 'Revision Quiz':
      return 'Quiz de Revisão';
  }
}

export function labelInterventionStatus(status: InterventionStatus): string {
  switch (status) {
    case 'CREATED':
      return 'Criada';
    case 'ASSIGNED':
      return 'Atribuída';
    case 'IN_PROGRESS':
      return 'Em Andamento';
    case 'COMPLETED':
      return 'Concluída';
    case 'REASSESSMENT_REQUIRED':
      return 'Reavaliação Necessária';
  }
}

export function labelPriority(priority: PriorityLevel): string {
  switch (priority) {
    case 'HIGH':
      return 'ALTA';
    case 'MEDIUM':
      return 'MÉDIA';
    case 'LOW':
      return 'BAIXA';
  }
}

export function labelRole(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'TEACHER':
      return 'Professor';
    case 'STUDENT':
      return 'Estudante';
  }
}

export function labelModuleStatus(status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING'): string {
  switch (status) {
    case 'COMPLETED':
      return 'CONCLUÍDO';
    case 'IN_PROGRESS':
      return 'EM ANDAMENTO';
    case 'UPCOMING':
      return 'PRÓXIMO';
  }
}

export function labelActivityStatus(status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'): string {
  switch (status) {
    case 'ASSIGNED':
      return 'ATRIBUÍDA';
    case 'IN_PROGRESS':
      return 'EM ANDAMENTO';
    case 'COMPLETED':
      return 'CONCLUÍDA';
  }
}

export function labelEventType(type: LearningEventType): string {
  switch (type) {
    case 'AssessmentSubmitted':
      return 'Avaliação Enviada';
    case 'ActivityCompleted':
      return 'Atividade Concluída';
    case 'LearningGoalUpdated':
      return 'Objetivo Atualizado';
    case 'CompetencyMasteryChanged':
      return 'Domínio de Competência Alterado';
    case 'StudentProgressUpdated':
      return 'Progresso do Estudante Atualizado';
  }
}

export function labelEngineSource(source: EngineSource): string {
  switch (source) {
    case 'GEMINI':
      return 'Gemini 4 Hydrogen';
    case 'DEMO_RULES':
      return 'Regras Pedagógicas DEMO';
    case 'RULE_ENGINE_FALLBACK':
      return 'Motor de Regras';
  }
}
